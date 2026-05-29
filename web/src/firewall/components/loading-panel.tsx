import { Skeleton } from "@/components/ui/skeleton"

export function LoadingPanel() {
  return (
    <div className="grid gap-3 rounded-lg border bg-card p-4">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}
