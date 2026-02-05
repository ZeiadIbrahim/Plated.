"use client";

import * as React from "react";
import { cx } from "@/lib/cx";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "destructive"
  | "ghost"
  | "chip";

type ButtonSize = "sm" | "md" | "lg" | "icon" | "iconSm";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  active?: boolean;
};

const base =
  "inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 disabled:cursor-not-allowed disabled:opacity-60 active:translate-y-px";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[#111111] text-white hover:-translate-y-0.5 hover:bg-black hover:shadow-[0_14px_36px_-22px_rgba(17,17,17,0.8)] hover:ring-1 hover:ring-black/40",
  secondary:
    "border border-black/10 bg-white/80 text-[#111111] shadow-[0_10px_25px_-18px_rgba(0,0,0,0.6)] hover:-translate-y-0.5 hover:border-black/30 hover:bg-white hover:shadow-[0_14px_32px_-18px_rgba(0,0,0,0.65)]",
  destructive:
    "bg-[#D9534F] text-white hover:-translate-y-0.5 hover:bg-[#C94743] hover:shadow-[0_12px_28px_-18px_rgba(217,83,79,0.7)] hover:ring-1 hover:ring-[#D9534F]/70 focus-visible:ring-[#D9534F]",
  ghost:
    "border border-transparent bg-transparent text-[#111111]/70 hover:-translate-y-0.5 hover:border-black/15 hover:bg-black/5 hover:text-[#111111]",
  chip:
    "border border-black/10 bg-white/70 text-[#111111]/70 hover:-translate-y-0.5 hover:border-black/30 hover:bg-black/5 hover:shadow-[0_8px_20px_-14px_rgba(17,17,17,0.6)] hover:ring-1 hover:ring-black/25",
};

const activeVariants: Partial<Record<ButtonVariant, string>> = {
  // chip: "border-transparent bg-[#111111] text-white hover:bg-black hover:ring-black/40",
  chip: "border-transparent bg-black/10 text-[#111111] hover:bg-black/20",
  secondary: "border-black/30 bg-white text-[#111111]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-[10px] uppercase tracking-[0.2em]",
  md: "px-5 py-2 text-xs uppercase tracking-[0.2em]",
  lg: "px-6 py-3 text-xs uppercase tracking-[0.2em]",
  icon: "h-10 w-10 p-0",
  iconSm: "h-7 w-7 p-0 text-[10px]",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "secondary",
      size = "md",
      active = false,
      className,
      type,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        data-active={active ? "true" : "false"}
        className={cx(
          base,
          sizes[size],
          variants[variant],
          active ? activeVariants[variant] : undefined,
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
