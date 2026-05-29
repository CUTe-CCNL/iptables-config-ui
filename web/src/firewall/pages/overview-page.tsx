import { useState } from "react"
import { AlertTriangle, Save } from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useI18n } from "@/lib/i18n"
import type { CommandStatus, Ruleset, SystemStatus } from "@/types/firewall"

import { SESSION_TOKEN_KEY } from "../constants"
import { StatusBadge } from "../components/status-badge"

export function OverviewPanel({
  system,
  token,
  onTokenChange,
  draft,
}: {
  system: SystemStatus | null
  token: string
  onTokenChange: (token: string) => void
  draft: Ruleset | null
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="space-y-4">
        <SessionTokenCard
          key={token}
          token={token}
          onTokenChange={onTokenChange}
        />
        <CapabilitiesCard system={system} />
      </section>
      <section className="space-y-4">
        <CommandStatusCard commands={system?.commands ?? []} />
        <DraftSummaryCard draft={draft} />
      </section>
    </div>
  )
}

function SessionTokenCard({
  token,
  onTokenChange,
}: {
  token: string
  onTokenChange: (token: string) => void
}) {
  const { t } = useI18n()
  const [value, setValue] = useState(token)

  function saveToken() {
    const next = value.trim()
    onTokenChange(next)
    if (next) {
      window.localStorage.setItem(SESSION_TOKEN_KEY, next)
      toast.success(t("toastSessionTokenSaved"))
      return
    }

    window.localStorage.removeItem(SESSION_TOKEN_KEY)
    toast.info(t("toastSessionTokenCleared"))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("sessionTitle")}</CardTitle>
        <CardDescription>{t("sessionDescription")}</CardDescription>
        <CardAction>
          <StatusBadge tone={token ? "success" : "warning"}>
            {token ? t("ready") : t("missing")}
          </StatusBadge>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="grid gap-2">
          <Label htmlFor="session-token">{t("sessionTokenLabel")}</Label>
          <Input
            id="session-token"
            type="password"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={t("sessionTokenPlaceholder")}
            autoComplete="off"
          />
        </div>
        <div className="flex items-end">
          <Button onClick={saveToken} className="w-full sm:w-auto">
            <Save className="size-4" />
            {t("save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function CapabilitiesCard({ system }: { system: SystemStatus | null }) {
  const { t } = useI18n()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("capabilitiesTitle")}</CardTitle>
        <CardDescription>{t("capabilitiesDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {(system?.capabilities ?? []).length ? (
          system?.capabilities.map((capability) => (
            <StatusBadge key={capability} tone="muted">
              {capability}
            </StatusBadge>
          ))
        ) : (
          <span className="text-sm text-muted-foreground">
            {t("noCapabilities")}
          </span>
        )}
      </CardContent>
    </Card>
  )
}

function CommandStatusCard({ commands }: { commands: CommandStatus[] }) {
  const { t } = useI18n()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("commandsTitle")}</CardTitle>
        <CardDescription>{t("commandsDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {commands.length ? (
          commands.map((command) => (
            <div
              key={command.name}
              className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_auto]"
            >
              <div className="min-w-0">
                <div className="font-medium">{command.name}</div>
                <div className="truncate font-mono text-xs text-muted-foreground">
                  {command.path || command.error || t("notFound")}
                </div>
              </div>
              <StatusBadge tone={command.available ? "success" : "danger"}>
                {command.available ? t("available") : t("missing")}
              </StatusBadge>
            </div>
          ))
        ) : (
          <div className="text-sm text-muted-foreground">
            {t("noCommandStatus")}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DraftSummaryCard({ draft }: { draft: Ruleset | null }) {
  const { t } = useI18n()
  const warnings = draft?.warnings ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("draftTitle")}</CardTitle>
        <CardDescription>{t("draftDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <SummaryItem
            label={t("policies")}
            value={draft?.policies.length ?? 0}
          />
          <SummaryItem
            label={t("filter")}
            value={draft?.filterRules.length ?? 0}
          />
          <SummaryItem label={t("nat")} value={draft?.natRules.length ?? 0} />
          <SummaryItem label={t("raw")} value={draft?.rawRules.length ?? 0} />
        </div>
        {warnings.length ? (
          <Alert className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
            <AlertTriangle className="size-4" />
            <AlertTitle>
              {t("parserWarningCount", { count: warnings.length })}
            </AlertTitle>
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              {t("unsupportedLinesPreserved")}
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  )
}

function SummaryItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-lg font-semibold">{value}</div>
    </div>
  )
}
