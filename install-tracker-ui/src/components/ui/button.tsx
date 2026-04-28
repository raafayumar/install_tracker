"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantStyles: Record<Variant, string> = {
  primary: "bg-sky-500 text-white shadow-[var(--shadow-glow)] hover:bg-sky-700 hover:-translate-y-[1px]",
  secondary: "bg-transparent text-sky-500 border-2 border-sky-500 hover:bg-[rgba(0,160,242,0.1)]",
  ghost: "bg-[rgba(255,255,255,0.04)] text-text-primary border border-border hover:border-sky-500 hover:text-sky-500",
};

const sizeStyles: Record<Size, string> = {
  sm: "px-4 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`
          inline-flex items-center justify-center gap-2 rounded-full font-bold
          transition-all duration-150 ease-out cursor-pointer
          disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0
          ${variantStyles[variant]} ${sizeStyles[size]} ${className}
        `}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
