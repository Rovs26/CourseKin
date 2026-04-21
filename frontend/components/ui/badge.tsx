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
        variant === "default" && "bg-slate-900 text-white",
        variant === "secondary" && "bg-slate-100 text-slate-700",
        variant === "outline" && "border border-slate-200 text-slate-700",
        className
      )}
      {...props}
    />
  );
}

export { Badge };