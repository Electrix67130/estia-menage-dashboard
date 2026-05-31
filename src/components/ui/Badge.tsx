import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "success" | "warning" | "danger" | "info";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

const variants: Record<Variant, string> = {
  default: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  success: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  danger: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  info: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
};

export default function Badge({ className, variant = "default", ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        variants[variant],
        className,
      )}
      {...rest}
    />
  );
}
