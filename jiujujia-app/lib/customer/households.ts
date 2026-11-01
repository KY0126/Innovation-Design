// Firestore access for issue #2 — households and invite codes (customer domain).
import {
  FirestoreError,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import { householdConverter, inviteCodeConverter } from "@/lib/firebase/converters";
import type { Household, Role } from "@/lib/shared/contracts";
import { generateInviteCode } from "./invite-code";
import { decideJoin, precheckJoin, toValidHousehold, type HouseholdInput, type JoinRejection } from "./household-rules";

const households = (db: Firestore) => collection(db, "households").withConverter(householdConverter);
const inviteCodeDoc = (db: Firestore, code: string) => doc(db, "inviteCodes", code).withConverter(inviteCodeConverter);

/** Family member creates the elder's household plus a unique invite code in one batch. */
export async function createHousehold(db: Firestore, uid: string, input: HouseholdInput): Promise<Household> {
  const valid = toValidHousehold(input);
  const code = await uniqueInviteCode(db);
  const ref = doc(households(db));
  const batch = writeBatch(db);
  batch.set(ref, {
    id: ref.id,
    ...valid,
    familyUids: [uid],
    elderUid: null,
    inviteCode: code,
    createdBy: uid,
    createdAt: serverTimestamp(),
  });
  batch.set(inviteCodeDoc(db, code), {
    code,
    householdId: ref.id,
    createdBy: uid,
    claimedBy: null,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  const created = await getDoc(ref);
  return created.data() as Household;
}

/** MVP: one household per person (the first one found). */
export async function findMyHousehold(db: Firestore, uid: string, role: Role): Promise<Household | null> {
  const q =
    role === "elder"
      ? query(households(db), where("elderUid", "==", uid), limit(1))
      : query(households(db), where("familyUids", "array-contains", uid), limit(1));
  const snap = await getDocs(q);
  return snap.empty ? null : snap.docs[0].data();
}

export type JoinResult = { ok: true; household: Household } | { ok: false; reason: JoinRejection };

/** Elder joins a household by entering its invite code. */
export async function joinHouseholdByCode(db: Firestore, uid: string, role: Role, rawCode: string): Promise<JoinResult> {
  const pre = precheckJoin(role, rawCode);
  if (!pre.ok) return pre;
  const inviteSnap = await getDoc(inviteCodeDoc(db, pre.code));
  const invite = inviteSnap.exists() ? inviteSnap.data() : null;
  const decision = decideJoin(invite, uid);
  if (!decision.ok) return decision;
  if (!invite) return { ok: false, reason: "not-found" };

  const householdRef = doc(households(db), invite.householdId);
  if (invite.claimedBy !== uid) {
    const batch = writeBatch(db);
    batch.update(doc(db, "households", invite.householdId), {
      elderUid: uid,
      elderJoinedAt: serverTimestamp(),
      joinCode: pre.code,
    });
    batch.update(doc(db, "inviteCodes", pre.code), { claimedBy: uid });
    await batch.commit();
  }
  const joined = await getDoc(householdRef);
  return { ok: true, household: joined.data() as Household };
}

async function uniqueInviteCode(db: Firestore): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode();
    if (!(await inviteCodeTaken(db, code))) return code;
  }
  throw new Error("無法產生邀請碼，請再試一次");
}

/** Someone else's existing code is unreadable (permission-denied) — that also means "taken". */
async function inviteCodeTaken(db: Firestore, code: string): Promise<boolean> {
  try {
    return (await getDoc(inviteCodeDoc(db, code))).exists();
  } catch (e) {
    if (e instanceof FirestoreError && e.code === "permission-denied") return true;
    throw e;
  }
}
