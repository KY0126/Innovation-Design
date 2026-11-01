"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { getFirebase } from "@/lib/firebase/client";
import type { UserProfile } from "./contracts";
import { getProfile } from "./profile";

export type AuthStatus = "loading" | "signed-out" | "needs-profile" | "ready" | "error";

interface AuthState {
  status: AuthStatus;
  user: User | null;
  profile: UserProfile | null;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const loadProfile = useCallback(async (current: User | null) => {
    if (!current) {
      setProfile(null);
      setStatus("signed-out");
      return;
    }
    try {
      const p = await getProfile(getFirebase().db, current.uid);
      setProfile(p);
      setStatus(p ? "ready" : "needs-profile");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    const { auth } = getFirebase();
    return onAuthStateChanged(auth, (current) => {
      setUser(current);
      void loadProfile(current);
    });
  }, [loadProfile]);

  const refreshProfile = useCallback(() => loadProfile(user), [loadProfile, user]);

  return (
    <AuthContext.Provider value={{ status, user, profile, refreshProfile }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
