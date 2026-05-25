import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  asChild?: boolean;
};

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ck-ring)] disabled:pointer-events-none disabled:opacity-50",
        variant === "default" && "bg-[var(--ck-primary)] text-white hover:bg-[var(--ck-primary-hover)]",
        variant === "outline" && "border border-[var(--ck-primary-border)] bg-white text-[var(--ck-primary)] hover:bg-[var(--ck-primary-soft)]",
        variant === "ghost" && "hover:bg-[var(--ck-primary-soft)]",
        variant === "destructive" && "bg-red-600 text-white hover:bg-red-700",
        size === "default" && "h-10 px-4 py-2",
        size === "sm" && "h-9 px-3",
        size === "lg" && "h-11 px-6",
        size === "icon" && "h-10 w-10",
        className
      )}
      {...props}
    />
  );
}

export { Button };
