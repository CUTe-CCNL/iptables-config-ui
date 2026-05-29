import { Component, type ErrorInfo, type ReactNode } from "react"
import { AlertTriangle } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useI18n } from "@/lib/i18n"

export class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("iptables-config-ui render error", error, info)
  }

  render() {
    if (this.state.error) {
      return <AppErrorFallback error={this.state.error} />
    }

    return this.props.children
  }
}

function AppErrorFallback({ error }: { error: Error }) {
  const { t } = useI18n()

  return (
    <main className="min-h-svh bg-background p-4">
      <Alert variant="destructive" className="mx-auto max-w-3xl">
        <AlertTriangle className="size-4" />
        <AlertTitle>{t("appRenderFailed")}</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    </main>
  )
}
