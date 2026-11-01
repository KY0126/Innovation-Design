import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { getFirebase } from "@/lib/firebase/client";

export async function signUpWithEmail(email: string, password: string) {
  const { auth } = getFirebase();
  return createUserWithEmailAndPassword(auth, email.trim(), password);
}

export async function signInWithEmail(email: string, password: string) {
  const { auth } = getFirebase();
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function signInWithGoogle() {
  const { auth } = getFirebase();
  return signInWithPopup(auth, new GoogleAuthProvider());
}

export async function signOutUser() {
  const { auth } = getFirebase();
  return signOut(auth);
}
