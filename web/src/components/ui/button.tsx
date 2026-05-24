import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

type Variant = "default" | "secondary" | "ghost" | "danger" | "success" | "outline";
type Size = "sm" | "md" | "icon";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

export function Button({ className, variant = "default", size = "md", ...props }: ButtonProps) {
  return <button className={cn("btn", `btn-${variant}`, `btn-${size}`, className)} {...props} />;
}

