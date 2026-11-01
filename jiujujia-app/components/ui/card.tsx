import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-border bg-card p-6 shadow-sm", className)} {...props} />;
}

export function Notice({
  tone = "info",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: "info" | "error" | "success" }) {
  const tones = {
    info: "border-border bg-muted text-foreground",
    error: "border-destructive/40 bg-destructive/10 text-destructive",
    success: "border-success/40 bg-success/10 text-success",
  };
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-lg border px-4 py-3 text-base", tones[tone], className)}
      {...props}
    />
  );
}
