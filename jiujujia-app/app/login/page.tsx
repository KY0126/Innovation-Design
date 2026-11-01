"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader, PageBody } from "@/components/common/app-header";
import { AuthForm, type AuthMode } from "@/components/common/auth-form";
import { signInWithEmail, signInWithGoogle, signUpWithEmail } from "@/lib/shared/auth-actions";
import { authErrorMessage } from "@/lib/shared/auth-errors";
import { useAuth } from "@/lib/shared/auth-context";

export default function LoginPage() {
  const { status } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "ready" || status === "needs-profile") router.replace("/");
  }, [status, router]);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    setSubmitting(true);
    try {
      await action();
      router.replace("/");
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <AppHeader />
      <PageBody>
        <div className="text-center">
          <h1 className="text-3xl font-bold">讓不同住的子女，也能顧好爸媽家</h1>
          <p className="mt-2 text-muted-foreground">由一位生活顧問陪你先評估、再改善、後關心</p>
        </div>
        <AuthForm
          mode={mode}
          onModeChange={(m) => {
            setMode(m);
            setError(null);
          }}
          onSubmit={(email, password) =>
            run(() => (mode === "signup" ? signUpWithEmail(email, password) : signInWithEmail(email, password)))
          }
          onGoogle={() => run(signInWithGoogle)}
          error={error}
          submitting={submitting}
        />
      </PageBody>
    </>
  );
}
