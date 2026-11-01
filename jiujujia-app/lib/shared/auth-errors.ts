/** Map Firebase Auth error codes to user-facing zh-TW messages. Never reveal whether the email or the password was wrong. */
const MESSAGES: Record<string, string> = {
  "auth/email-already-in-use": "此 Email 已註冊，請直接登入",
  "auth/invalid-credential": "Email 或密碼不正確",
  "auth/invalid-login-credentials": "Email 或密碼不正確",
  "auth/wrong-password": "Email 或密碼不正確",
  "auth/user-not-found": "Email 或密碼不正確",
  "auth/invalid-email": "Email 格式不正確",
  "auth/weak-password": "密碼至少需要 6 碼",
  "auth/popup-closed-by-user": "已取消 Google 登入",
  "auth/cancelled-popup-request": "已取消 Google 登入",
  "auth/popup-blocked": "瀏覽器擋住了登入視窗，請允許彈出視窗後再試一次",
  "auth/network-request-failed": "網路連線失敗，請稍後再試",
  "auth/too-many-requests": "嘗試次數過多，請稍後再試",
};

export const DEFAULT_AUTH_ERROR = "登入時發生錯誤，請稍後再試";

export function authErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  return MESSAGES[code] ?? DEFAULT_AUTH_ERROR;
}
