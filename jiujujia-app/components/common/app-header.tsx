import { Button } from "@/components/ui/button";

export function AppHeader({
  displayName,
  roleLabel,
  onSignOut,
}: {
  displayName?: string;
  roleLabel?: string;
  onSignOut?: () => void;
}) {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold text-primary">揪居家</span>
          <span className="hidden text-sm text-muted-foreground sm:inline">陪一個家，從居家安全開始</span>
        </div>
        {displayName && (
          <div className="flex items-center gap-3">
            <span className="text-base" data-testid="current-user">
              {displayName}
              {roleLabel && <span className="ml-2 rounded-full bg-muted px-3 py-1 text-sm">{roleLabel}</span>}
            </span>
            {onSignOut && (
              <Button variant="outline" onClick={onSignOut}>
                登出
              </Button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

export function PageBody({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 py-8">{children}</main>;
}

export function LoadingState({ text = "載入中…" }: { text?: string }) {
  return (
    <p role="status" className="py-16 text-center text-muted-foreground">
      {text}
    </p>
  );
}
