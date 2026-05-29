import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import type { BadgeTone } from "../types"

export function StatusBadge({
  tone,
  children,
}: {
  tone: BadgeTone
  children: ReactNode
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 font-medium",
        tone === "success" &&
          "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
        tone === "warning" &&
          "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
        tone === "danger" &&
          "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
        tone === "muted" && "border-border bg-muted text-muted-foreground"
      )}
    >
      {children}
    </Badge>
  )
}
