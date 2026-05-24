import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "default" | "success" | "warning" | "danger" | "muted";
  children: ReactNode;
};

export function Badge({ className, tone = "default", ...props }: BadgeProps) {
  return <span className={cn("badge", `badge-${tone}`, className)} {...props} />;
}

