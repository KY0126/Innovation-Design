"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader, LoadingState, PageBody } from "@/components/common/app-header";
import { RolePicker } from "@/components/common/role-picker";
import { getFirebase } from "@/lib/firebase/client";
import { useAuth } from "@/lib/shared/auth-context";
import type { SelfSignupRole } from "@/lib/shared/contracts";
import { createProfile } from "@/lib/shared/profile";

export default function OnboardingPage() {
  const { status, user, refreshProfile } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "signed-out") router.replace("/login");
    if (status === "ready") router.replace("/home");
  }, [status, router]);

  async function handleSubmit(role: SelfSignupRole, displayName: string) {
    if (!user) return;
    setError(null);
    setSubmitting(true);
    try {
      await createProfile(getFirebase().db, user.uid, { role, displayName, email: user.email ?? "" });
      await refreshProfile();
      router.replace("/home");
    } catch {
      setError("儲存身分失敗，請再試一次");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <AppHeader />
      <PageBody>
        {status !== "needs-profile" || !user ? (
          <LoadingState />
        ) : (
          <RolePicker
            defaultName={user.displayName ?? ""}
            onSubmit={handleSubmit}
            error={error}
            submitting={submitting}
          />
        )}
      </PageBody>
    </>
  );
}
