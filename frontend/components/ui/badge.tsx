import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "secondary" | "outline";
};

function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
        variant === "default" && "bg-[var(--ck-primary)] text-white",
        variant === "secondary" && "bg-[var(--ck-primary-soft)] text-[var(--ck-primary)]",
        variant === "outline" && "border border-[var(--ck-primary-border)] text-[var(--ck-primary)]",
        className
      )}
      {...props}
    />
  );
}

export { Badge };
