import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  const styles = {
    primary: "bg-cyan-500 text-slate-950 hover:bg-cyan-400",
    secondary: "bg-white/10 text-white hover:bg-white/15 border border-white/15",
    ghost: "text-slate-200 hover:bg-white/10",
    danger: "bg-rose-500 text-white hover:bg-rose-400"
  };

  return (
    <button
      className={cn("inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition", styles[variant], className)}
      {...props}
    />
  );
}
