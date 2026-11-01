"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppHeader, LoadingState, PageBody } from "@/components/common/app-header";
import { Notice } from "@/components/ui/card";
import { useAuth } from "@/lib/shared/auth-context";

/** Entry: route people to login, role selection, or their home page. */
export default function EntryPage() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "signed-out") router.replace("/login");
    if (status === "needs-profile") router.replace("/onboarding");
    if (status === "ready") router.replace("/home");
  }, [status, router]);

  return (
    <>
      <AppHeader />
      <PageBody>
        {status === "error" ? (
          <Notice tone="error">讀取帳號資料失敗，請重新整理頁面。</Notice>
        ) : (
          <LoadingState />
        )}
      </PageBody>
    </>
  );
}
