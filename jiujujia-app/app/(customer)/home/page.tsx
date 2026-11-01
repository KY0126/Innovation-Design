"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader, LoadingState, PageBody } from "@/components/common/app-header";
import { HouseholdCard } from "@/components/customer/household-card";
import { HouseholdForm } from "@/components/customer/household-form";
import { JoinHouseholdForm, JoinedNotice } from "@/components/customer/join-household-form";
import { Notice } from "@/components/ui/card";
import { getFirebase } from "@/lib/firebase/client";
import { JOIN_MESSAGES, type HouseholdInput } from "@/lib/customer/household-rules";
import { createHousehold, findMyHousehold, joinHouseholdByCode } from "@/lib/customer/households";
import { signOutUser } from "@/lib/shared/auth-actions";
import { useAuth } from "@/lib/shared/auth-context";
import type { Household } from "@/lib/shared/contracts";
import { ROLE_LABELS, isCustomerRole } from "@/lib/shared/roles";

export default function HomePage() {
  const { status, profile } = useAuth();
  const router = useRouter();
  const [household, setHousehold] = useState<Household | null | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [justJoined, setJustJoined] = useState(false);

  useEffect(() => {
    if (status === "signed-out") router.replace("/login");
    if (status === "needs-profile") router.replace("/onboarding");
  }, [status, router]);

  useEffect(() => {
    if (!profile || !isCustomerRole(profile.role)) return;
    let cancelled = false;
    findMyHousehold(getFirebase().db, profile.uid, profile.role)
      .then((found) => {
        if (!cancelled) setHousehold(found);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [profile]);

  async function handleCreate(input: HouseholdInput) {
    if (!profile) return;
    setFormError(null);
    setSubmitting(true);
    try {
      setHousehold(await createHousehold(getFirebase().db, profile.uid, input));
    } catch {
      setFormError("建立失敗，請檢查網路後再試一次");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleJoin(code: string) {
    if (!profile) return;
    setFormError(null);
    setSubmitting(true);
    try {
      const result = await joinHouseholdByCode(getFirebase().db, profile.uid, profile.role, code);
      if (result.ok) {
        setHousehold(result.household);
        setJustJoined(true);
      } else {
        setFormError(JOIN_MESSAGES[result.reason]);
      }
    } catch {
      setFormError("加入失敗，請檢查網路後再試一次");
    } finally {
      setSubmitting(false);
    }
  }

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
        {!isCustomerRole(profile.role) ? (
          <Notice>門市端功能尚未開放，請稍後再來。</Notice>
        ) : loadError ? (
          <Notice tone="error">讀取長輩家資料失敗，請重新整理頁面。</Notice>
        ) : household === undefined ? (
          <LoadingState />
        ) : household ? (
          <>
            {justJoined && <JoinedNotice />}
            <HouseholdCard household={household} viewer={profile.role} />
          </>
        ) : profile.role === "family" ? (
          <HouseholdForm onSubmit={handleCreate} error={formError} submitting={submitting} />
        ) : (
          <JoinHouseholdForm onSubmit={handleJoin} error={formError} submitting={submitting} />
        )}
      </PageBody>
    </>
  );
}
