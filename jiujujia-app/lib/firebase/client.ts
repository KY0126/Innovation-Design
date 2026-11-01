// Firebase Client SDK — browser only. Never import lib/firebase/server.ts from client code.
import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

/** No real project configured in .env.local → use the local emulators. */
export const usingEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === "true" || !projectId;

const config: FirebaseOptions = usingEmulators
  ? {
      apiKey: "demo-api-key",
      authDomain: "demo-jiujujia.firebaseapp.com",
      projectId: "demo-jiujujia",
      appId: "demo-jiujujia-app",
    }
  : {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

let services: { app: FirebaseApp; auth: Auth; db: Firestore } | null = null;

export function getFirebase() {
  if (services) return services;
  const app = getApps().length ? getApp() : initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  if (usingEmulators) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }
  services = { app, auth, db };
  return services;
}
