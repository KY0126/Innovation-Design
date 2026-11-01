import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const FIELD =
  "min-h-12 w-full rounded-lg border border-border bg-card px-4 text-base text-foreground " +
  "placeholder:text-muted-foreground focus:outline focus:outline-2 focus:outline-primary " +
  "aria-[invalid=true]:border-destructive";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(FIELD, className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(FIELD, className)} {...props} />;
}
