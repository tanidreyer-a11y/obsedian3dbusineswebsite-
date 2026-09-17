import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "icon" | "outline";
  children: ReactNode;
};

export function Button({ className, variant = "outline", children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center border border-border font-mono text-[0.68rem] uppercase tracking-[0.2em] transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary",
        variant === "icon"
          ? "size-11 rounded-full bg-background/70 text-foreground backdrop-blur-sm hover:border-primary hover:text-primary"
          : "min-h-12 px-6 text-foreground hover:border-primary hover:bg-primary hover:text-primary-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
