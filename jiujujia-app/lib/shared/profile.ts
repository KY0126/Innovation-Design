import { doc, getDoc, serverTimestamp, setDoc, type Firestore } from "firebase/firestore";
import { userConverter } from "@/lib/firebase/converters";
import type { SelfSignupRole, UserProfile } from "./contracts";
import { isSelfSignupRole } from "./roles";
import { validateDisplayName } from "./auth-validation";

export async function getProfile(db: Firestore, uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid).withConverter(userConverter));
  return snap.exists() ? snap.data() : null;
}

export async function createProfile(
  db: Firestore,
  uid: string,
  input: { role: SelfSignupRole; displayName: string; email: string },
): Promise<void> {
  if (!isSelfSignupRole(input.role)) throw new Error("只開放家人、長輩自行註冊");
  const nameError = validateDisplayName(input.displayName);
  if (nameError) throw new Error(nameError);
  await setDoc(doc(db, "users", uid).withConverter(userConverter), {
    uid,
    role: input.role,
    displayName: input.displayName.trim(),
    email: input.email,
    createdAt: serverTimestamp(),
  });
}
