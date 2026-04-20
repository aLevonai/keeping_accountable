import { cn } from "@/utils/cn";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-2xl font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none",
          {
            "bg-rose-500 text-white hover:bg-rose-600 shadow-sm": variant === "primary",
            "bg-white text-stone-800 border border-stone-200 hover:bg-stone-50": variant === "secondary",
            "bg-transparent text-stone-600 hover:bg-stone-100": variant === "ghost",
            "bg-red-500 text-white hover:bg-red-600": variant === "danger",
          },
          {
            "text-sm px-4 py-2": size === "sm",
            "text-base px-5 py-3": size === "md",
            "text-lg px-6 py-4 w-full": size === "lg",
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
