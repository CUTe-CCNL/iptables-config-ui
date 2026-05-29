import type { BadgeTone } from "./types"

export function targetTone(target: string): BadgeTone {
  if (target === "ACCEPT") return "success"
  if (target === "DROP") return "danger"
  return "warning"
}
