"""三個 MCP Server 共用：資料庫、身分與權限、稽核紀錄、回傳格式。"""
from __future__ import annotations

import json
import os
import re
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

from mcp.server.mcpserver.exceptions import ToolError

ROOT = Path(__file__).resolve().parent.parent
HID_RE = re.compile(r"^[a-z_]{2,12}$")
CASE_RE = re.compile(r"^C-[A-Z]{2,8}$")
DAY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def db() -> sqlite3.Connection:
    path = Path(os.environ.get("JIUJU_DB") or ROOT / "data" / "demo.db")
    if not path.exists():
        raise SystemExit(f"[揪居家] 找不到資料庫 {path}，請先執行 python make_data.py")
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


class Ctx:
    """目前登入者。由 Host 啟動 Server 時用環境變數帶入；資料庫查不到就拒絕啟動（fail closed）。"""

    def __init__(self) -> None:
        self.user_id = os.environ.get("JIUJU_USER", "")
        with db() as c:
            row = c.execute("SELECT * FROM users WHERE id=?", (self.user_id,)).fetchone()
        if not row:
            raise SystemExit(f"[揪居家] 使用者 {self.user_id!r} 不存在，Server 拒絕啟動")
        self.role = row["role"]
        self.name = row["name"]
        self.store_id = row["store_id"]

    def require_role(self, *roles: str) -> None:
        if self.role not in roles:
            label = {"family": "家人", "advisor": "生活顧問", "tech": "技師", "hq": "總部"}
            raise ToolError(f"權限不足：這個動作只有{'、'.join(label[r] for r in roles)}可以執行，"
                            f"目前登入的是{label.get(self.role, self.role)}（{self.name}）。")

    def household(self, c: sqlite3.Connection, household_id: str) -> sqlite3.Row:
        if not isinstance(household_id, str) or not HID_RE.match(household_id):
            raise ToolError("household_id 格式不正確，例如 lin（林媽媽家）。")
        h = c.execute("SELECT * FROM households WHERE id=?", (household_id,)).fetchone()
        if not h:
            raise ToolError(f"找不到家庭 {household_id}。")
        allowed = (
            (self.role == "family" and c.execute("SELECT 1 FROM members WHERE household_id=? AND user_id=?",
                                                 (household_id, self.user_id)).fetchone())
            or (self.role == "advisor" and h["store_id"] == self.store_id)
            or self.role == "hq"
            # v1.3：技師只能看手上有工單的家庭（到府實測、回報差異用）
            or (self.role == "tech" and c.execute(
                "SELECT 1 FROM work_orders w JOIN cases k ON k.id=w.case_id WHERE k.household_id=? AND w.staff_id=?",
                (household_id, self.user_id)).fetchone())
        )
        if not allowed:
            raise ToolError("權限不足：您沒有這個家庭的存取權限，無法提供資料。")
        return h

    def case(self, c: sqlite3.Connection, case_id: str) -> sqlite3.Row:
        if not isinstance(case_id, str) or not CASE_RE.match(case_id):
            raise ToolError("case_id 格式不正確，例如 C-LIN。")
        row = c.execute("SELECT * FROM cases WHERE id=?", (case_id,)).fetchone()
        if not row:
            raise ToolError(f"找不到案件 {case_id}。")
        self.household(c, row["household_id"])
        return row


def audit(server: str, tool: str, ctx: Ctx, args: dict, outcome: str) -> None:
    """稽核紀錄寫到 stderr（stdout 只能放 MCP 協定訊息）。"""
    line = {"at": datetime.now().isoformat(timespec="seconds"), "server": server, "tool": tool,
            "user": ctx.user_id, "role": ctx.role, "args": args, "outcome": outcome}
    print(json.dumps(line, ensure_ascii=False), file=sys.stderr, flush=True)


def ok(data: dict) -> str:
    """統一回傳格式：JSON 文字，並標示資料性質。"""
    with db() as c:
        label = c.execute("SELECT v FROM meta WHERE k='label'").fetchone()[0]
    return json.dumps({"data_label": label, **data}, ensure_ascii=False)


def now() -> str:
    return datetime.now().isoformat(timespec="minutes")
