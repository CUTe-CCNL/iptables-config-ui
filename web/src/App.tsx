import { AppErrorBoundary } from "@/firewall/components/app-error-boundary"
import { FirewallApp } from "@/firewall/firewall-app"

export function App() {
  return (
    <AppErrorBoundary>
      <FirewallApp />
    </AppErrorBoundary>
  )
}

export default App
