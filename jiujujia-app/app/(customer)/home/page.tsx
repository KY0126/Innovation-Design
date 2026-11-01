"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppHeader, LoadingState, PageBody } from "@/components/common/app-header";
import { Notice } from "@/components/ui/card";
import { signOutUser } from "@/lib/shared/auth-actions";
import { useAuth } from "@/lib/shared/auth-context";
import { ROLE_LABELS, isCustomerRole } from "@/lib/shared/roles";

export default function HomePage() {
  const { status, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "signed-out") router.replace("/login");
    if (status === "needs-profile") router.replace("/onboarding");
  }, [status, router]);

  async function handleSignOut() {
    await signOutUser();
    router.replace("/login");
  }

  if (status !== "ready" || !profile) {
    return (
      <>
        <AppHeader />
        <PageBody>
          <LoadingState />
        </PageBody>
      </>
    );
  }

  return (
    <>
      <AppHeader displayName={profile.displayName} roleLabel={ROLE_LABELS[profile.role]} onSignOut={handleSignOut} />
      <PageBody>
        <h1 className="text-2xl font-bold">{profile.displayName}，你好</h1>
        {isCustomerRole(profile.role) ? (
          <Notice>長輩家功能開發中（#2）。</Notice>
        ) : (
          <Notice>門市端功能尚未開放，請稍後再來。</Notice>
        )}
      </PageBody>
    </>
  );
}
