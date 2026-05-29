import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ErrorInfo,
  type ReactNode,
} from "react"
import type { ColumnDef } from "@tanstack/react-table"
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Edit3,
  Loader2,
  Moon,
  Plus,
  Power,
  RefreshCw,
  RotateCcw,
  Save,
  Shield,
  Sun,
  Terminal,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { api, ApiError } from "@/api"
import { DataTable } from "@/components/data-table"
import { SortableDataTable } from "@/components/sortable-data-table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useTheme } from "@/components/theme-provider"
import { compact, clone, cn, isEqualJSON, newId, nextOrder } from "@/lib/utils"
import { SUPPORTED_LANGUAGES, useI18n, type Language } from "@/lib/i18n"
import {
  filterRuleSchema,
  masqueradeSchema,
  portForwardSchema,
  zodMessages,
} from "@/lib/validation"
import type {
  CommandStatus,
  FilterRule,
  NatRule,
  Policy,
  RawRule,
  Ruleset,
  SystemStatus,
} from "@/types/firewall"

type Tab = "overview" | "filter" | "nat" | "raw"
type TableName = "filter" | "nat"
type ConfirmAction = "apply" | "rollback" | "shutdown" | "refresh" | null
type FilterEditor =
  | { mode: "create"; initialChain?: string }
  | { mode: "edit"; rule: FilterRule }
  | null
type NatEditor =
  | { mode: "create"; initialChain?: string }
  | { mode: "edit"; rule: NatRule }
  | null
type BadgeTone = "default" | "success" | "warning" | "danger" | "muted"
type FilterProtocolOption = "any" | "tcp" | "udp" | "icmp"
type TFunction = ReturnType<typeof useI18n>["t"]
type ErrorDisplay = { title: string; description?: string }
type ErrorCopy = {
  unknownError: string
  snapshotDriftTitle: string
  snapshotDriftHint: string
  useMockModeHint: string
}
type FilterRuleFormState = {
  chain: FilterRule["chain"]
  target: FilterRule["target"]
  protocol: FilterProtocolOption
  source: string
  destination: string
  inInterface: string
  outInterface: string
  sourcePort: string
  destinationPort: string
  comment: string
}
type NatRuleFormState = {
  chain: NatRule["chain"]
  protocol: "tcp" | "udp"
  listenPort: string
  destinationIp: string
  destinationPort: string
  sourceCidr: string
  inInterface: string
  outInterface: string
  comment: string
}

const SESSION_TOKEN_KEY = "iptables-config-ui-session-token"
const BUILT_IN_CHAINS: Record<TableName, string[]> = {
  filter: ["INPUT", "FORWARD", "OUTPUT"],
  nat: ["PREROUTING", "INPUT", "OUTPUT", "POSTROUTING"],
}
const FILTER_TARGETS = ["ACCEPT", "DROP", "REJECT", "RETURN"]
const CHAIN_NAME_RE = /^[A-Za-z0-9_.:+-]{1,32}$/
const ALL_CHAINS_VALUE = "__iptables-ui/all-chains"
const SNAPSHOT_DRIFT_MESSAGE =
  "live iptables rules changed since draft was loaded"
const COMMANDS_UNAVAILABLE_MESSAGE = "iptables commands unavailable"

const emptyRuleset: Ruleset = {
  snapshotId: "",
  policies: [],
  filterRules: [],
  natRules: [],
  rawRules: [],
  warnings: [],
}

export function App() {
  return (
    <AppErrorBoundary>
      <FirewallApp />
    </AppErrorBoundary>
  )
}

class AppErrorBoundary extends Component<
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

function FirewallApp() {
  const { t } = useI18n()
  const errorCopyRef = useRef(errorCopy(t))
  const [system, setSystem] = useState<SystemStatus | null>(null)
  const [rules, setRules] = useState<Ruleset | null>(null)
  const [draft, setDraft] = useState<Ruleset | null>(null)
  const [token, setToken] = useState("")
  const [activeTab, setActiveTab] = useState<Tab>("overview")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ErrorDisplay | null>(null)
  const [filterEditor, setFilterEditor] = useState<FilterEditor>(null)
  const [natEditor, setNatEditor] = useState<NatEditor>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)

  const pending = useMemo(() => {
    if (!rules || !draft) return false
    return !isEqualJSON(stripVolatile(rules), stripVolatile(draft))
  }, [rules, draft])

  const pendingCount = useMemo(() => {
    if (!rules || !draft) return 0

    let count = 0
    if (!isEqualJSON(rules.policies, draft.policies)) count += 1
    if (!isEqualJSON(rules.filterRules, draft.filterRules)) {
      count +=
        Math.abs(draft.filterRules.length - rules.filterRules.length) || 1
    }
    if (!isEqualJSON(rules.natRules, draft.natRules)) {
      count += Math.abs(draft.natRules.length - rules.natRules.length) || 1
    }

    return count
  }, [rules, draft])

  const commandsMissing =
    system?.commands.some((command) => !command.available) ?? false
  const canMutate = Boolean(draft && rules && token && !loading && !busy)
  const canValidate = Boolean(draft && token && !loading && !busy)

  useEffect(() => {
    errorCopyRef.current = errorCopy(t)
  }, [t])

  const boot = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const sessionToken = readSessionToken()
      setToken(sessionToken)

      const status = await api.system()
      setSystem(status)

      if (!sessionToken) {
        setRules(null)
        setDraft(clone(emptyRuleset))
        return
      }

      const response = await api.rules(sessionToken)
      setRules(response.ruleset)
      setDraft(clone(response.ruleset))
    } catch (err) {
      setError(formatErrorDisplay(err, errorCopyRef.current))
      setDraft(clone(emptyRuleset))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void boot()
  }, [boot])

  async function refreshRules(discardDraft: boolean) {
    if (pending && !discardDraft) {
      setConfirmAction("refresh")
      return
    }

    setBusy(true)
    setError(null)
    try {
      const [status, response] = await Promise.all([
        api.system(),
        api.rules(token),
      ])
      setSystem(status)
      setRules(response.ruleset)
      setDraft(clone(response.ruleset))
      toast.success(t("toastRulesRefreshedTitle"), {
        description: t("toastRulesRefreshedDescription"),
      })
    } catch (err) {
      const details = formatErrorDisplay(err, errorCopyRef.current)
      setError(details)
      toast.error(t("toastRefreshFailedTitle"), {
        description: errorToastDescription(details),
      })
    } finally {
      setBusy(false)
    }
  }

  async function validateDraft() {
    if (!draft || !token) return false

    setBusy(true)
    setError(null)
    try {
      const validation = await api.validate(token, draft)
      if (!validation.valid) {
        toast.warning(t("toastDraftInvalidTitle"), {
          description: validation.errors.join(" "),
        })
        return false
      }

      toast.success(t("toastDraftValidTitle"), {
        description: t("toastDraftValidDescription"),
      })
      return true
    } catch (err) {
      const details = formatErrorDisplay(err, errorCopyRef.current)
      setError(details)
      toast.error(t("toastValidationFailedTitle"), {
        description: errorToastDescription(details),
      })
      return false
    } finally {
      setBusy(false)
    }
  }

  async function runConfirmAction() {
    const action = confirmAction
    if (!action) return

    if (action === "refresh") {
      await refreshRules(true)
      setConfirmAction(null)
      return
    }

    if (!draft || !rules || !token) return

    setBusy(true)
    setError(null)
    try {
      if (action === "apply") {
        const validation = await api.validate(token, draft)
        if (!validation.valid) {
          toast.warning(t("toastDraftInvalidTitle"), {
            description: validation.errors.join(" "),
          })
          return
        }

        const response = await api.apply(token, rules.snapshotId, draft)
        setRules(response.ruleset)
        setDraft(clone(response.ruleset))
        toast.success(t("toastRulesAppliedTitle"), {
          description: t("toastRulesAppliedDescription"),
        })
      }

      if (action === "rollback") {
        const response = await api.rollback(token)
        setRules(response.ruleset)
        setDraft(clone(response.ruleset))
        toast.success(t("toastRollbackRestoredTitle"), {
          description: t("toastRollbackRestoredDescription"),
        })
      }

      if (action === "shutdown") {
        await api.shutdown(token)
        toast.success(t("toastServerShuttingDownTitle"), {
          description: t("toastServerShuttingDownDescription"),
        })
      }
    } catch (err) {
      const details = formatErrorDisplay(err, errorCopyRef.current)
      const snapshotDrift = isSnapshotDriftError(err)
      setError(details)
      toast.error(
        snapshotDrift ? t("snapshotDriftTitle") : actionTitle(action, t),
        {
          description: snapshotDrift
            ? details.description
            : errorToastDescription(details),
        }
      )
    } finally {
      setBusy(false)
      setConfirmAction(null)
    }
  }

  function updateDraft(next: Ruleset) {
    setDraft(next)
  }

  const filterDialogKey =
    filterEditor?.mode === "edit"
      ? filterEditor.rule.id
      : filterEditor?.mode === "create"
        ? (filterEditor.initialChain ?? filterEditor.mode)
        : "filter-dialog-closed"
  const natDialogKey =
    natEditor?.mode === "edit"
      ? natEditor.rule.id
      : natEditor?.mode === "create"
        ? (natEditor.initialChain ?? natEditor.mode)
        : "nat-dialog-closed"

  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 p-3 sm:p-4 lg:p-6">
        <header className="sticky top-0 z-20 -mx-3 border-b bg-background/95 px-3 py-3 backdrop-blur sm:-mx-4 sm:px-4 lg:-mx-6 lg:px-6">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
            <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Shield className="size-5" />
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-semibold tracking-normal">
                    iptables Config UI
                  </h1>
                  <p className="truncate text-sm text-muted-foreground">
                    {system
                      ? `${system.host} / ${system.user}`
                      : t("loadingHostStatus")}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={system?.mock ? "warning" : "success"}>
                  {system?.mock ? t("modeMock") : t("modeLive")}
                </StatusBadge>
                <StatusBadge tone={system?.root ? "success" : "warning"}>
                  {system?.root ? t("rootUser") : t("nonRootUser")}
                </StatusBadge>
                <StatusBadge tone={commandsMissing ? "danger" : "success"}>
                  {commandsMissing ? t("commandsMissing") : t("commandsReady")}
                </StatusBadge>
                <StatusBadge tone={pending ? "warning" : "muted"}>
                  {t("pendingCount", { count: pendingCount })}
                </StatusBadge>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <LanguageSelect />
              <Button
                variant="outline"
                onClick={() => void refreshRules(false)}
                disabled={busy || loading}
              >
                <RefreshCw className={cn("size-4", busy && "animate-spin")} />
                {t("refresh")}
              </Button>
              <Button
                variant="secondary"
                onClick={() => void validateDraft()}
                disabled={!canValidate}
              >
                <ClipboardCheck className="size-4" />
                {t("validate")}
              </Button>
              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                onClick={() => setConfirmAction("apply")}
                disabled={!canMutate || !pending}
              >
                <Save className="size-4" />
                {t("apply")}
              </Button>
              <Button
                variant="outline"
                onClick={() => setConfirmAction("rollback")}
                disabled={!canMutate}
              >
                <RotateCcw className="size-4" />
                {t("rollback")}
              </Button>
              <Button
                variant="destructive"
                onClick={() => setConfirmAction("shutdown")}
                disabled={!token || busy}
              >
                <Power className="size-4" />
                {t("shutdown")}
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <StatusCards
          loading={loading}
          system={system}
          rules={rules}
          draft={draft}
          pendingCount={pendingCount}
        />

        {error ? (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>{error.title}</AlertTitle>
            {error.description ? (
              <AlertDescription>{error.description}</AlertDescription>
            ) : null}
          </Alert>
        ) : null}

        {!token ? (
          <Alert className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
            <AlertTriangle className="size-4" />
            <AlertTitle>{t("sessionTokenMissingTitle")}</AlertTitle>
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              {t("sessionTokenMissingDescription")}
            </AlertDescription>
          </Alert>
        ) : null}

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as Tab)}
        >
          <TabsList className="w-full justify-start overflow-hidden border-b">
            <TabsTrigger value="overview">{t("tabOverview")}</TabsTrigger>
            <TabsTrigger value="filter">{t("tabFilter")}</TabsTrigger>
            <TabsTrigger value="nat">{t("tabNat")}</TabsTrigger>
            <TabsTrigger value="raw">{t("tabRaw")}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            {loading ? (
              <LoadingPanel />
            ) : (
              <OverviewPanel
                system={system}
                token={token}
                onTokenChange={setToken}
                draft={draft}
              />
            )}
          </TabsContent>

          <TabsContent value="filter" className="mt-4">
            {loading ? (
              <LoadingPanel />
            ) : draft ? (
              <FilterRulesPanel
                ruleset={draft}
                onChange={updateDraft}
                onCreate={(initialChain) =>
                  setFilterEditor({ mode: "create", initialChain })
                }
                onEdit={(rule) => setFilterEditor({ mode: "edit", rule })}
              />
            ) : null}
          </TabsContent>

          <TabsContent value="nat" className="mt-4">
            {loading ? (
              <LoadingPanel />
            ) : draft ? (
              <NatPanel
                ruleset={draft}
                onChange={updateDraft}
                onCreate={(initialChain) =>
                  setNatEditor({ mode: "create", initialChain })
                }
                onEdit={(rule) => setNatEditor({ mode: "edit", rule })}
              />
            ) : null}
          </TabsContent>

          <TabsContent value="raw" className="mt-4">
            {loading ? (
              <LoadingPanel />
            ) : draft ? (
              <RawPanel ruleset={draft} />
            ) : null}
          </TabsContent>
        </Tabs>

        <FilterRuleDialog
          key={filterDialogKey}
          editor={filterEditor}
          ruleset={draft ?? emptyRuleset}
          nextOrderValue={nextOrder(draft?.filterRules ?? [])}
          onClose={() => setFilterEditor(null)}
          onSave={(rule) => {
            if (!draft) return

            const filterRules =
              filterEditor?.mode === "edit"
                ? draft.filterRules.map((item) =>
                    item.id === rule.id ? rule : item
                  )
                : [...draft.filterRules, rule]

            updateDraft({ ...draft, filterRules })
            setFilterEditor(null)
            toast.success(
              filterEditor?.mode === "edit"
                ? t("toastRuleUpdated")
                : t("toastRuleAdded")
            )
          }}
        />

        <NatRuleDialog
          key={natDialogKey}
          editor={natEditor}
          ruleset={draft ?? emptyRuleset}
          nextOrderValue={nextOrder(draft?.natRules ?? [])}
          onClose={() => setNatEditor(null)}
          onSave={(rule) => {
            if (!draft) return

            const natRules =
              natEditor?.mode === "edit"
                ? draft.natRules.map((item) =>
                    item.id === rule.id ? rule : item
                  )
                : [...draft.natRules, rule]

            updateDraft({ ...draft, natRules })
            setNatEditor(null)
            toast.success(
              natEditor?.mode === "edit"
                ? t("toastNatRuleUpdated")
                : t("toastNatRuleAdded")
            )
          }}
        />

        <ConfirmActionDialog
          action={confirmAction}
          busy={busy}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => void runConfirmAction()}
        />
      </div>
    </main>
  )
}

function StatusCards({
  loading,
  system,
  rules,
  draft,
  pendingCount,
}: {
  loading: boolean
  system: SystemStatus | null
  rules: Ruleset | null
  draft: Ruleset | null
  pendingCount: number
}) {
  const { t } = useI18n()
  const items = [
    {
      label: t("statusListenAddress"),
      value: system?.addr ?? "127.0.0.1:8921",
    },
    {
      label: t("statusSnapshot"),
      value: rules?.snapshotId
        ? rules.snapshotId.slice(0, 12)
        : t("unavailable"),
    },
    {
      label: t("statusFilterRules"),
      value: String(draft?.filterRules.length ?? 0),
    },
    { label: t("statusNatRules"), value: String(draft?.natRules.length ?? 0) },
    { label: t("statusRawLines"), value: String(draft?.rawRules.length ?? 0) },
    { label: t("statusPendingChanges"), value: String(pendingCount) },
  ]

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => (
        <Card key={item.label} size="sm">
          <CardHeader>
            <CardDescription>{item.label}</CardDescription>
            <CardTitle className="font-mono text-lg">
              {loading ? <Skeleton className="h-6 w-24" /> : item.value}
            </CardTitle>
          </CardHeader>
        </Card>
      ))}
    </section>
  )
}

function OverviewPanel({
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

function FilterRulesPanel({
  ruleset,
  onChange,
  onCreate,
  onEdit,
}: {
  ruleset: Ruleset
  onChange: (ruleset: Ruleset) => void
  onCreate: (initialChain?: string) => void
  onEdit: (rule: FilterRule) => void
}) {
  const { t } = useI18n()
  const chains = useMemo(() => tableChainNames(ruleset, "filter"), [ruleset])
  const [chainFilter, setChainFilter] = useState(ALL_CHAINS_VALUE)
  const sortedRows = useMemo(
    () => [...ruleset.filterRules].sort((a, b) => a.order - b.order),
    [ruleset.filterRules]
  )
  const chainSections = useMemo(
    () =>
      chains.map((chain) => ({
        chain,
        builtIn: isBuiltInChain("filter", chain),
        count: sortedRows.filter((rule) => rule.chain === chain).length,
        policy: policyForChain(ruleset, "filter", chain),
        rows: sortedRows.filter((rule) => rule.chain === chain),
      })),
    [chains, ruleset, sortedRows]
  )
  const visibleSections = useMemo(
    () => {
      if (chainFilter !== ALL_CHAINS_VALUE) {
        return chainSections.filter((section) => section.chain === chainFilter)
      }

      const populatedSections = chainSections.filter(
        (section) => section.count > 0
      )
      return populatedSections.length ? populatedSections : chainSections
    },
    [chainFilter, chainSections]
  )

  useEffect(() => {
    if (chainFilter !== ALL_CHAINS_VALUE && !chains.includes(chainFilter)) {
      setChainFilter(ALL_CHAINS_VALUE)
    }
  }, [chainFilter, chains])

  const remove = useCallback(
    (rule: FilterRule) => {
      onChange({
        ...ruleset,
        filterRules: ruleset.filterRules.filter((item) => item.id !== rule.id),
      })
    },
    [onChange, ruleset]
  )

  const move = useCallback(
    (rule: FilterRule, direction: -1 | 1, visibleRows: FilterRule[]) => {
      onChange({
        ...ruleset,
        filterRules: moveRuleByVisibleOrder(
          ruleset.filterRules,
          visibleRows,
          rule,
          direction
        ),
      })
    },
    [onChange, ruleset]
  )

  const reorder = useCallback(
    (activeId: string, overId: string, visibleRows: FilterRule[]) => {
      onChange({
        ...ruleset,
        filterRules: reorderRulesByVisibleDrop(
          ruleset.filterRules,
          visibleRows,
          activeId,
          overId
        ),
      })
    },
    [onChange, ruleset]
  )

  const columnsForRows = useCallback(
    (sectionRows: FilterRule[]): ColumnDef<FilterRule>[] => [
      {
        header: t("columnOrder"),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.order}
          </span>
        ),
        size: 72,
      },
      {
        header: t("columnTarget"),
        cell: ({ row }) => (
          <StatusBadge tone={targetTone(row.original.target)}>
            {row.original.target}
          </StatusBadge>
        ),
        size: 96,
      },
      {
        header: t("columnMatch"),
        cell: ({ row }) => <RuleMatch rule={row.original} />,
      },
      {
        header: t("columnComment"),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.comment || "-"}
          </span>
        ),
      },
      {
        header: t("columnActions"),
        cell: ({ row }) => {
          const index = sectionRows.findIndex(
            (item) => item.id === row.original.id
          )
          return (
            <div className="flex items-center justify-end gap-1">
              <IconButton
                label={t("moveRuleUp")}
                onClick={() => move(row.original, -1, sectionRows)}
                disabled={index <= 0}
              >
                <ChevronUp className="size-4" />
              </IconButton>
              <IconButton
                label={t("moveRuleDown")}
                onClick={() => move(row.original, 1, sectionRows)}
                disabled={index >= sectionRows.length - 1}
              >
                <ChevronDown className="size-4" />
              </IconButton>
              <IconButton
                label={t("editRule")}
                onClick={() => onEdit(row.original)}
              >
                <Edit3 className="size-4" />
              </IconButton>
              <IconButton
                label={t("deleteRule")}
                onClick={() => remove(row.original)}
              >
                <Trash2 className="size-4" />
              </IconButton>
            </div>
          )
        },
        size: 180,
      },
    ],
    [move, onEdit, remove, t]
  )

  return (
    <section className="grid items-start gap-4 xl:grid-cols-[15rem_minmax(0,1fr)_20rem]">
      <ChainNavigation
        title={t("chainDirectory")}
        description={t("chainDirectoryDescription")}
        items={chainSections}
        activeValue={chainFilter}
        allCount={sortedRows.length}
        onValueChange={setChainFilter}
      />

      <div className="grid min-w-0 content-start gap-4 self-start">
        <div className="rounded-lg border bg-card p-3 xl:hidden">
          <ChainFilterSelect
            value={chainFilter}
            onValueChange={setChainFilter}
            chains={chains}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-normal">
              {t("filterRulesTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("filterRulesDescription")}
            </p>
          </div>
          <Button
            onClick={() =>
              onCreate(
                chainFilter === ALL_CHAINS_VALUE ? undefined : chainFilter
              )
            }
          >
            <Plus className="size-4" />
            {t("addRule")}
          </Button>
        </div>

        <div className="grid gap-4">
          {visibleSections.map((section) => (
            <section
              key={section.chain}
              className="overflow-hidden rounded-lg border bg-card"
            >
              <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-mono text-base font-semibold tracking-normal">
                      {section.chain}
                    </h3>
                    <Badge variant="secondary">
                      {section.builtIn
                        ? t("builtInChain")
                        : t("customChainBadge")}
                    </Badge>
                    <StatusBadge
                      tone={section.policy === "DROP" ? "danger" : "muted"}
                    >
                      {t("policyLabel")}: {section.policy}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("chainRuleCount", { count: section.count })}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCreate(section.chain)}
                >
                  <Plus className="size-4" />
                  {t("addRule")}
                </Button>
              </div>
              <div className="p-3">
                {section.rows.length ? (
                  <SortableDataTable
                    data={section.rows}
                    columns={columnsForRows(section.rows)}
                    empty={t("noRulesInChain")}
                    dragLabel={t("dragRuleToReorder")}
                    getRowId={(row) => row.id}
                    onReorder={(activeId, overId) =>
                      reorder(activeId, overId, section.rows)
                    }
                    ariaLabel={`${section.chain} ${t("filterRulesTitle")}`}
                    density="compact"
                  />
                ) : (
                  <ChainEmptyState
                    message={t("noRulesInChain")}
                    actionLabel={t("addRule")}
                    onAction={() => onCreate(section.chain)}
                  />
                )}
              </div>
            </section>
          ))}
        </div>
      </div>

      <aside className="order-first grid gap-4 self-start xl:order-none xl:sticky xl:top-28">
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-base font-semibold tracking-normal">
            {t("tableToolsTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("tableToolsDescription")}
          </p>
        </div>
        <PoliciesEditor ruleset={ruleset} onChange={onChange} table="filter" />
        <ChainManager ruleset={ruleset} onChange={onChange} table="filter" />
      </aside>
    </section>
  )
}

function ChainNavigation({
  title,
  description,
  items,
  activeValue,
  allCount,
  onValueChange,
}: {
  title: string
  description: string
  items: {
    chain: string
    builtIn: boolean
    count: number
    rawCount?: number
  }[]
  activeValue: string
  allCount: number
  onValueChange: (value: string) => void
}) {
  const { t } = useI18n()

  return (
    <aside className="hidden xl:block">
      <div className="sticky top-28 grid gap-3 rounded-lg border bg-card p-3">
        <div>
          <h2 className="text-base font-semibold tracking-normal">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="grid gap-1">
          <Button
            type="button"
            variant={activeValue === ALL_CHAINS_VALUE ? "secondary" : "ghost"}
            className="h-auto min-h-8 w-full justify-between gap-2 px-2 py-2 text-left"
            onClick={() => onValueChange(ALL_CHAINS_VALUE)}
          >
            <span className="truncate">{t("allChains")}</span>
            <Badge variant="secondary">{allCount}</Badge>
          </Button>
          {items.map((item) => (
            <Button
              key={item.chain}
              type="button"
              variant={activeValue === item.chain ? "secondary" : "ghost"}
              className="h-auto min-h-9 w-full justify-between gap-2 px-2 py-2 text-left"
              onClick={() => onValueChange(item.chain)}
            >
              <span className="grid min-w-0 gap-0.5">
                <span className="truncate font-mono">{item.chain}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {item.builtIn ? t("builtInChain") : t("customChainBadge")}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <Badge variant="secondary">{item.count}</Badge>
                {item.rawCount ? (
                  <Badge variant="outline">{item.rawCount}</Badge>
                ) : null}
              </span>
            </Button>
          ))}
        </div>
      </div>
    </aside>
  )
}

function ChainEmptyState({
  message,
  actionLabel,
  onAction,
}: {
  message: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="flex min-h-28 flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-center">
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      {actionLabel && onAction ? (
        <Button type="button" variant="outline" size="sm" onClick={onAction}>
          <Plus className="size-4" />
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}

function PoliciesEditor({
  ruleset,
  onChange,
  table,
}: {
  ruleset: Ruleset
  onChange: (ruleset: Ruleset) => void
  table: TableName
}) {
  const { t } = useI18n()
  const policies = [...ruleset.policies]
    .filter(
      (policy) => policy.table === table && isBuiltInChain(table, policy.chain)
    )
    .sort((a, b) => a.order - b.order)

  function updatePolicy(policy: Policy, value: string) {
    onChange({
      ...ruleset,
      policies: ruleset.policies.map((item) =>
        item.table === policy.table && item.chain === policy.chain
          ? { ...item, policy: value }
          : item
      ),
    })
  }

  return (
    <div className="grid gap-3 rounded-lg border bg-card p-4">
      <div>
        <h2 className="text-base font-semibold tracking-normal">
          {table === "filter"
            ? t("defaultPoliciesTitle")
            : t("natPoliciesTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("policiesDescription")}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
        {policies.map((policy) => (
          <div key={`${policy.table}-${policy.chain}`} className="grid gap-2">
            <Label>{policy.chain}</Label>
            <Select
              value={policy.policy}
              onValueChange={(value) => updatePolicy(policy, value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="ACCEPT">ACCEPT</SelectItem>
                  <SelectItem value="DROP">DROP</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChainManager({
  ruleset,
  onChange,
  table,
}: {
  ruleset: Ruleset
  onChange: (ruleset: Ruleset) => void
  table: TableName
}) {
  const { t } = useI18n()
  const inputId = useMemo(() => newId(`${table}-chain`), [table])
  const [chainName, setChainName] = useState("")
  const [errors, setErrors] = useState<string[]>([])
  const chains = useMemo(
    () => tableChainNames(ruleset, table),
    [ruleset, table]
  )
  const customPolicies = useMemo(
    () =>
      [...ruleset.policies]
        .filter(
          (policy) =>
            policy.table === table && !isBuiltInChain(table, policy.chain)
        )
        .sort((a, b) => a.order - b.order),
    [ruleset.policies, table]
  )

  function addChain() {
    const chain = chainName.trim()
    if (!CHAIN_NAME_RE.test(chain)) {
      setErrors([t("validationChainName")])
      return
    }
    if (chains.includes(chain)) {
      setErrors([t("validationChainExists")])
      return
    }

    onChange({
      ...ruleset,
      policies: [
        ...ruleset.policies,
        {
          table,
          chain,
          policy: "-",
          order: nextOrder(
            ruleset.policies.filter((item) => item.table === table)
          ),
        },
      ],
    })
    setChainName("")
    setErrors([])
    toast.success(t("toastChainAdded", { chain }))
  }

  function removeChain(chain: string) {
    if (hasExternalChainReference(ruleset, table, chain)) {
      setErrors([t("chainInUse")])
      return
    }

    onChange({
      ...ruleset,
      policies: ruleset.policies.filter(
        (policy) => !(policy.table === table && policy.chain === chain)
      ),
      filterRules:
        table === "filter"
          ? ruleset.filterRules.filter((rule) => rule.chain !== chain)
          : ruleset.filterRules,
      natRules:
        table === "nat"
          ? ruleset.natRules.filter((rule) => rule.chain !== chain)
          : ruleset.natRules,
      rawRules: ruleset.rawRules.filter(
        (rule) => !(rule.table === table && rule.chain === chain)
      ),
    })
    setErrors([])
    toast.success(t("toastChainDeleted", { chain }))
  }

  return (
    <div className="grid gap-4 rounded-lg border bg-card p-4">
      <div>
        <h2 className="text-base font-semibold tracking-normal">
          {t("customChainsTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("customChainsDescription")}
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="grid flex-1 gap-2">
          <Label htmlFor={inputId}>{t("fieldNewChain")}</Label>
          <Input
            id={inputId}
            value={chainName}
            onChange={(event) => setChainName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                addChain()
              }
            }}
            placeholder="MYCHAIN"
          />
        </div>
        <Button type="button" onClick={addChain}>
          <Plus className="size-4" />
          {t("addChain")}
        </Button>
      </div>
      <ErrorList errors={errors} />
      {customPolicies.length ? (
        <div className="flex flex-wrap gap-2">
          {customPolicies.map((policy) => {
            const referenced = hasExternalChainReference(
              ruleset,
              table,
              policy.chain
            )
            return (
              <div
                key={`${policy.table}-${policy.chain}`}
                className="flex items-center gap-2 rounded-md border bg-background px-3 py-2"
              >
                <span className="font-mono text-sm">{policy.chain}</span>
                <Badge variant="secondary">{t("customChainBadge")}</Badge>
                <IconButton
                  label={referenced ? t("chainInUse") : t("deleteChain")}
                  onClick={() => removeChain(policy.chain)}
                  disabled={referenced}
                >
                  <Trash2 className="size-4" />
                </IconButton>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("noCustomChains")}</p>
      )}
    </div>
  )
}

function NatPanel({
  ruleset,
  onChange,
  onCreate,
  onEdit,
}: {
  ruleset: Ruleset
  onChange: (ruleset: Ruleset) => void
  onCreate: (initialChain?: string) => void
  onEdit: (rule: NatRule) => void
}) {
  const { t } = useI18n()
  const chains = useMemo(() => tableChainNames(ruleset, "nat"), [ruleset])
  const [chainFilter, setChainFilter] = useState(ALL_CHAINS_VALUE)
  const sortedRows = useMemo(
    () => [...ruleset.natRules].sort((a, b) => a.order - b.order),
    [ruleset.natRules]
  )
  const rawRows = useMemo(
    () =>
      [...ruleset.rawRules]
        .filter((rule) => rule.table === "nat")
        .sort((a, b) => a.order - b.order),
    [ruleset.rawRules]
  )
  const chainSections = useMemo(
    () =>
      chains.map((chain) => {
        const rows = sortedRows.filter((rule) => rule.chain === chain)
        const readOnlyRows = rawRows.filter((rule) => rule.chain === chain)

        return {
          chain,
          builtIn: isBuiltInChain("nat", chain),
          count: rows.length,
          rawCount: readOnlyRows.length,
          policy: policyForChain(ruleset, "nat", chain),
          rows,
          rawRows: readOnlyRows,
        }
      }),
    [chains, rawRows, ruleset, sortedRows]
  )
  const visibleSections = useMemo(
    () => {
      if (chainFilter !== ALL_CHAINS_VALUE) {
        return chainSections.filter((section) => section.chain === chainFilter)
      }

      const populatedSections = chainSections.filter(
        (section) => section.count + section.rawCount > 0
      )
      return populatedSections.length ? populatedSections : chainSections
    },
    [chainFilter, chainSections]
  )

  useEffect(() => {
    if (chainFilter !== ALL_CHAINS_VALUE && !chains.includes(chainFilter)) {
      setChainFilter(ALL_CHAINS_VALUE)
    }
  }, [chainFilter, chains])

  const remove = useCallback(
    (rule: NatRule) => {
      onChange({
        ...ruleset,
        natRules: ruleset.natRules.filter((item) => item.id !== rule.id),
      })
    },
    [onChange, ruleset]
  )

  const move = useCallback(
    (rule: NatRule, direction: -1 | 1, visibleRows: NatRule[]) => {
      onChange({
        ...ruleset,
        natRules: moveRuleByVisibleOrder(
          ruleset.natRules,
          visibleRows,
          rule,
          direction
        ),
      })
    },
    [onChange, ruleset]
  )

  const reorder = useCallback(
    (activeId: string, overId: string, visibleRows: NatRule[]) => {
      onChange({
        ...ruleset,
        natRules: reorderRulesByVisibleDrop(
          ruleset.natRules,
          visibleRows,
          activeId,
          overId
        ),
      })
    },
    [onChange, ruleset]
  )

  const columnsForRows = useCallback(
    (sectionRows: NatRule[]): ColumnDef<NatRule>[] => [
      {
        header: t("columnOrder"),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.order}
          </span>
        ),
        size: 72,
      },
      {
        header: t("columnType"),
        cell: ({ row }) => (
          <StatusBadge
            tone={row.original.type === "port-forward" ? "warning" : "success"}
          >
            {row.original.type === "port-forward"
              ? t("portForwardTitle")
              : "MASQUERADE"}
          </StatusBadge>
        ),
        size: 130,
      },
      {
        header: t("columnMatch"),
        cell: ({ row }) =>
          row.original.type === "port-forward" ? (
            <span className="font-mono text-xs">
              {row.original.protocol}/{row.original.listenPort} -&gt;{" "}
              {row.original.destinationIp}:{row.original.destinationPort}
            </span>
          ) : (
            <span className="font-mono text-xs">
              {t("sourceLabel")} {row.original.sourceCidr || t("any")} -&gt;{" "}
              {row.original.outInterface || t("anyInterface")}
            </span>
          ),
      },
      {
        header: t("columnScope"),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.inInterface ? `in:${row.original.inInterface} ` : ""}
            {row.original.outInterface
              ? `out:${row.original.outInterface} `
              : ""}
            {row.original.sourceCidr ? `src:${row.original.sourceCidr}` : ""}
          </span>
        ),
      },
      {
        header: t("columnComment"),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.comment || "-"}
          </span>
        ),
      },
      {
        header: t("columnActions"),
        cell: ({ row }) => {
          const index = sectionRows.findIndex(
            (item) => item.id === row.original.id
          )
          return (
            <div className="flex items-center justify-end gap-1">
              <IconButton
                label={t("moveNatRuleUp")}
                onClick={() => move(row.original, -1, sectionRows)}
                disabled={index <= 0}
              >
                <ChevronUp className="size-4" />
              </IconButton>
              <IconButton
                label={t("moveNatRuleDown")}
                onClick={() => move(row.original, 1, sectionRows)}
                disabled={index >= sectionRows.length - 1}
              >
                <ChevronDown className="size-4" />
              </IconButton>
              <IconButton
                label={t("editNatRule")}
                onClick={() => onEdit(row.original)}
              >
                <Edit3 className="size-4" />
              </IconButton>
              <IconButton
                label={t("deleteNatRule")}
                onClick={() => remove(row.original)}
              >
                <Trash2 className="size-4" />
              </IconButton>
            </div>
          )
        },
        size: 180,
      },
    ],
    [move, onEdit, remove, t]
  )
  const rawColumns = useMemo<ColumnDef<RawRule>[]>(
    () => [
      {
        header: t("columnOrder"),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.order}
          </span>
        ),
        size: 72,
      },
      {
        header: t("columnLine"),
        cell: ({ row }) => (
          <code className="block min-w-80 font-mono text-xs whitespace-nowrap">
            {row.original.line}
          </code>
        ),
      },
      {
        header: t("columnReason"),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.reason}
          </span>
        ),
      },
    ],
    [t]
  )

  return (
    <section className="grid items-start gap-4 xl:grid-cols-[15rem_minmax(0,1fr)_20rem]">
      <ChainNavigation
        title={t("chainDirectory")}
        description={t("chainDirectoryDescription")}
        items={chainSections}
        activeValue={chainFilter}
        allCount={sortedRows.length + rawRows.length}
        onValueChange={setChainFilter}
      />

      <div className="grid min-w-0 content-start gap-4 self-start">
        <div className="rounded-lg border bg-card p-3 xl:hidden">
          <ChainFilterSelect
            value={chainFilter}
            onValueChange={setChainFilter}
            chains={chains}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-normal">
              {t("natRulesTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("natRulesDescription")}
            </p>
          </div>
          <Button
            onClick={() =>
              onCreate(
                chainFilter === ALL_CHAINS_VALUE ? undefined : chainFilter
              )
            }
          >
            <Plus className="size-4" />
            {t("addRule")}
          </Button>
        </div>

        <div className="grid gap-4">
          {visibleSections.map((section) => (
            <section
              key={section.chain}
              className="overflow-hidden rounded-lg border bg-card"
            >
              <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-mono text-base font-semibold tracking-normal">
                      {section.chain}
                    </h3>
                    <Badge variant="secondary">
                      {section.builtIn
                        ? t("builtInChain")
                        : t("customChainBadge")}
                    </Badge>
                    <StatusBadge tone="muted">
                      {t("policyLabel")}: {section.policy}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("chainRuleCount", { count: section.count })}
                    {section.rawCount
                      ? ` / ${t("readOnlyCount", {
                          count: section.rawCount,
                        })}`
                      : ""}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCreate(section.chain)}
                >
                  <Plus className="size-4" />
                  {t("addRule")}
                </Button>
              </div>
              <div className="grid gap-3 p-3">
                {section.rows.length ? (
                  <SortableDataTable
                    data={section.rows}
                    columns={columnsForRows(section.rows)}
                    empty={t("noRulesInChain")}
                    dragLabel={t("dragRuleToReorder")}
                    getRowId={(row) => row.id}
                    onReorder={(activeId, overId) =>
                      reorder(activeId, overId, section.rows)
                    }
                    ariaLabel={`${section.chain} ${t("natRulesTitle")}`}
                    density="compact"
                  />
                ) : null}
                {section.rawRows.length ? (
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-sm font-medium tracking-normal">
                        {t("readOnlyRules")}
                      </h4>
                      <Badge variant="secondary">
                        {t("readOnlyCount", { count: section.rawRows.length })}
                      </Badge>
                    </div>
                    <DataTable
                      data={section.rawRows}
                      columns={rawColumns}
                      empty={t("noUnsupportedRules")}
                      ariaLabel={`${section.chain} ${t("natRawTitle")}`}
                      density="compact"
                    />
                  </div>
                ) : null}
                {!section.rows.length && !section.rawRows.length ? (
                  <ChainEmptyState
                    message={t("noRulesInChain")}
                    actionLabel={t("addRule")}
                    onAction={() => onCreate(section.chain)}
                  />
                ) : null}
              </div>
            </section>
          ))}
        </div>
      </div>

      <aside className="order-first grid gap-4 self-start xl:order-none xl:sticky xl:top-28">
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-base font-semibold tracking-normal">
            {t("tableToolsTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("tableToolsDescription")}
          </p>
        </div>
        <PoliciesEditor ruleset={ruleset} onChange={onChange} table="nat" />
        <ChainManager ruleset={ruleset} onChange={onChange} table="nat" />
      </aside>
    </section>
  )
}

function RawPanel({ ruleset }: { ruleset: Ruleset }) {
  const { t } = useI18n()
  const columns = useMemo<ColumnDef<RawRule>[]>(
    () => [
      {
        header: t("columnOrder"),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.order}
          </span>
        ),
        size: 72,
      },
      {
        header: t("columnLine"),
        cell: ({ row }) => (
          <code className="block min-w-80 font-mono text-xs whitespace-nowrap">
            {row.original.line}
          </code>
        ),
      },
      {
        header: t("columnReason"),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.reason}
          </span>
        ),
      },
    ],
    [t]
  )

  const rawGroups = useMemo(
    () => groupRawRules(ruleset.rawRules),
    [ruleset.rawRules]
  )

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-normal">
            {t("rawTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("rawDescription")}</p>
        </div>
        <StatusBadge tone="muted">
          {t("readOnlyCount", { count: ruleset.rawRules.length })}
        </StatusBadge>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="grid min-w-0 gap-3">
          {rawGroups.length ? (
            rawGroups.map((group) => (
              <section
                key={`${group.table}-${group.chain}`}
                className="overflow-hidden rounded-lg border bg-card"
              >
                <div className="flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{group.table}</Badge>
                    <h3 className="font-mono text-base font-semibold tracking-normal">
                      {group.chain || t("raw")}
                    </h3>
                  </div>
                  <StatusBadge tone="muted">
                    {t("readOnlyCount", { count: group.rows.length })}
                  </StatusBadge>
                </div>
                <div className="p-3">
                  <DataTable
                    data={group.rows}
                    columns={columns}
                    empty={t("noUnsupportedRules")}
                    ariaLabel={`${group.table} ${group.chain} ${t("rawTitle")}`}
                    density="compact"
                  />
                </div>
              </section>
            ))
          ) : (
            <DataTable
              data={[]}
              columns={columns}
              empty={t("noUnsupportedRules")}
              ariaLabel={t("rawTitle")}
              density="compact"
            />
          )}
        </div>

        <div className="grid gap-2 self-start xl:sticky xl:top-28">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Terminal className="size-4" />
            {t("rawSnapshotTitle")}
          </div>
          <ScrollArea className="h-[420px] rounded-lg border bg-zinc-950 p-3 text-zinc-50">
            <pre className="min-w-max font-mono text-xs leading-relaxed">
              {ruleset.raw || t("noRawSnapshot")}
            </pre>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      </div>
    </section>
  )
}

function FilterRuleDialog({
  editor,
  ruleset,
  nextOrderValue,
  onClose,
  onSave,
}: {
  editor: FilterEditor
  ruleset: Ruleset
  nextOrderValue: number
  onClose: () => void
  onSave: (rule: FilterRule) => void
}) {
  const { t, translateValidationMessage } = useI18n()
  const existing = editor?.mode === "edit" ? editor.rule : undefined
  const chainOptions = useMemo(
    () => tableChainNames(ruleset, "filter"),
    [ruleset]
  )
  const targetOptions = useMemo(
    () => uniqueStrings([...FILTER_TARGETS, ...chainOptions]),
    [chainOptions]
  )
  const initialChain =
    existing?.chain ??
    (editor?.mode === "create" ? editor.initialChain : undefined) ??
    "INPUT"
  const [form, setForm] = useState<FilterRuleFormState>({
    chain: preferredChain(chainOptions, initialChain),
    target: existing?.target ?? "ACCEPT",
    protocol: existing?.protocol ? existing.protocol : "any",
    source: existing?.source ?? "",
    destination: existing?.destination ?? "",
    inInterface: existing?.inInterface ?? "",
    outInterface: existing?.outInterface ?? "",
    sourcePort: existing?.sourcePort ?? "",
    destinationPort: existing?.destinationPort ?? "",
    comment: existing?.comment ?? "",
  })
  const [errors, setErrors] = useState<string[]>([])

  function save() {
    const parsed = filterRuleSchema({
      chains: chainOptions,
      targets: targetOptions,
    }).safeParse(form)
    if (!parsed.success) {
      setErrors(zodMessages(parsed.error, translateValidationMessage))
      return
    }

    const value = parsed.data
    onSave({
      id: existing?.id ?? newId("filter"),
      table: "filter",
      chain: value.chain,
      target: value.target,
      protocol: value.protocol === "any" ? "" : value.protocol,
      source: compact(value.source),
      destination: compact(value.destination),
      inInterface: compact(value.inInterface),
      outInterface: compact(value.outInterface),
      sourcePort: compact(value.sourcePort),
      destinationPort: compact(value.destinationPort),
      comment: compact(value.comment),
      order: existing?.order ?? nextOrderValue,
      readOnly: false,
    })
  }

  return (
    <Dialog open={editor !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {editor?.mode === "edit" ? t("editFilterRule") : t("addFilterRule")}
          </DialogTitle>
          <DialogDescription>
            {t("filterRuleDialogDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SelectField
            label={t("fieldChain")}
            value={form.chain}
            onValueChange={(value) => setForm({ ...form, chain: value })}
            options={chainOptions}
          />
          <SelectField
            label={t("fieldTarget")}
            value={form.target}
            onValueChange={(value) => setForm({ ...form, target: value })}
            options={targetOptions}
          />
          <SelectField
            label={t("fieldProtocol")}
            value={form.protocol}
            onValueChange={(value) =>
              setForm({
                ...form,
                protocol: value as FilterProtocolOption,
              })
            }
            options={["any", "tcp", "udp", "icmp"]}
            formatOption={(option) =>
              option === "any" ? t("optionAny") : option
            }
          />
          <TextField
            label={t("fieldSource")}
            value={form.source}
            onChange={(value) => setForm({ ...form, source: value })}
            placeholder="10.0.0.0/24"
          />
          <TextField
            label={t("fieldDestination")}
            value={form.destination}
            onChange={(value) => setForm({ ...form, destination: value })}
            placeholder="192.168.1.10"
          />
          <TextField
            label={t("fieldInputInterface")}
            value={form.inInterface}
            onChange={(value) => setForm({ ...form, inInterface: value })}
            placeholder="eth0"
          />
          <TextField
            label={t("fieldOutputInterface")}
            value={form.outInterface}
            onChange={(value) => setForm({ ...form, outInterface: value })}
            placeholder="eth1"
          />
          <TextField
            label={t("fieldSourcePort")}
            value={form.sourcePort}
            onChange={(value) => setForm({ ...form, sourcePort: value })}
            inputMode="numeric"
          />
          <TextField
            label={t("fieldDestinationPort")}
            value={form.destinationPort}
            onChange={(value) => setForm({ ...form, destinationPort: value })}
            inputMode="numeric"
          />
          <div className="sm:col-span-2 lg:col-span-3">
            <TextField
              label={t("fieldComment")}
              value={form.comment}
              onChange={(value) => setForm({ ...form, comment: value })}
              placeholder={t("commentPlaceholder")}
            />
          </div>
        </div>
        <ErrorList errors={errors} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button onClick={save}>
            <Save className="size-4" />
            {t("saveRule")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ConfirmActionDialog({
  action,
  busy,
  onCancel,
  onConfirm,
}: {
  action: ConfirmAction
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const { t } = useI18n()
  const meta = confirmMeta(action, t)

  return (
    <AlertDialog
      open={action !== null}
      onOpenChange={(open) => !open && onCancel()}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia
            className={cn(action === "shutdown" && "text-destructive")}
          >
            {action === "shutdown" ? <Power /> : <AlertTriangle />}
          </AlertDialogMedia>
          <AlertDialogTitle>{meta.title}</AlertDialogTitle>
          <AlertDialogDescription>{meta.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("cancel")}</AlertDialogCancel>
          <Button
            variant={action === "shutdown" ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {meta.confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  type = "text",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  inputMode?: ComponentProps<typeof Input>["inputMode"]
  type?: ComponentProps<typeof Input>["type"]
}) {
  const id = useMemo(() => newId("field"), [])

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        type={type}
      />
    </div>
  )
}

function SelectField({
  label,
  value,
  onValueChange,
  options,
  formatOption = (option) => option,
}: {
  label: string
  value: string
  onValueChange: (value: string) => void
  options: string[]
  formatOption?: (option: string) => string
}) {
  const id = useMemo(() => newId("select"), [])

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {formatOption(option)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

function ChainFilterSelect({
  value,
  onValueChange,
  chains,
}: {
  value: string
  onValueChange: (value: string) => void
  chains: string[]
}) {
  const { t } = useI18n()
  const id = useMemo(() => newId("chain-filter"), [])

  return (
    <div className="grid min-w-44 gap-2">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {t("chainFilterLabel")}
      </Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value={ALL_CHAINS_VALUE}>{t("allChains")}</SelectItem>
            {chains.map((chain) => (
              <SelectItem key={chain} value={chain}>
                {chain}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

function ErrorList({ errors }: { errors: string[] }) {
  const { t } = useI18n()

  if (!errors.length) return null

  return (
    <Alert variant="destructive">
      <AlertTriangle className="size-4" />
      <AlertTitle>{t("fixValidationErrors")}</AlertTitle>
      <AlertDescription>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          {errors.map((error, index) => (
            <li key={`${error}-${index}`}>{error}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}

function RuleMatch({ rule }: { rule: FilterRule }) {
  const { t } = useI18n()
  const parts = [
    ["proto", rule.protocol || t("any")],
    ["src", rule.source],
    ["dst", rule.destination],
    ["in", rule.inInterface],
    ["out", rule.outInterface],
    ["sport", rule.sourcePort],
    ["dport", rule.destinationPort],
  ].filter(([, value]) => value)

  return (
    <span className="flex min-w-80 flex-wrap gap-1 font-mono text-xs">
      {parts.map(([label, value]) => (
        <span
          key={`${label}-${value}`}
          className="rounded-md border bg-muted/40 px-1.5 py-0.5"
        >
          <span className="text-muted-foreground">{label}:</span>
          {value}
        </span>
      ))}
    </span>
  )
}

function LoadingPanel() {
  return (
    <div className="grid gap-3 rounded-lg border bg-card p-4">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}

function StatusBadge({
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

function IconButton({
  label,
  children,
  ...props
}: ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          {...props}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function LanguageSelect() {
  const { language, setLanguage, t } = useI18n()

  return (
    <Select
      value={language}
      onValueChange={(value) => setLanguage(value as Language)}
    >
      <SelectTrigger
        size="sm"
        className="w-[8.5rem]"
        aria-label={t("languageSelectorLabel")}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {SUPPORTED_LANGUAGES.map((item) => (
            <SelectItem key={item.code} value={item.code}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const { t } = useI18n()
  const isDark = theme === "dark"

  return (
    <IconButton
      label={isDark ? t("switchToLightMode") : t("switchToDarkMode")}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </IconButton>
  )
}

function tableChainNames(ruleset: Ruleset, table: TableName) {
  const chains = new Set(BUILT_IN_CHAINS[table])
  const policies = [...ruleset.policies]
    .filter((policy) => policy.table === table)
    .sort((a, b) => a.order - b.order)
  policies.forEach((policy) => chains.add(policy.chain))
  if (table === "filter") {
    ruleset.filterRules.forEach((rule) => chains.add(rule.chain))
  } else {
    ruleset.natRules.forEach((rule) => chains.add(rule.chain))
  }
  ruleset.rawRules.forEach((rule) => {
    if (rule.table === table && rule.chain) {
      chains.add(rule.chain)
    }
  })
  return [...chains]
}

function policyForChain(ruleset: Ruleset, table: TableName, chain: string) {
  return (
    ruleset.policies.find(
      (policy) => policy.table === table && policy.chain === chain
    )?.policy ?? "-"
  )
}

function preferredChain(chains: string[], preferred: string) {
  return chains.includes(preferred) ? preferred : (chains[0] ?? preferred)
}

function groupRawRules(rawRules: RawRule[]) {
  const groups = new Map<
    string,
    { table: string; chain: string; rows: RawRule[] }
  >()

  ;[...rawRules]
    .sort(
      (a, b) =>
        a.table.localeCompare(b.table) ||
        (a.chain || "").localeCompare(b.chain || "") ||
        a.order - b.order
    )
    .forEach((rule) => {
      const key = `${rule.table}:${rule.chain || ""}`
      const group =
        groups.get(key) ??
        {
          table: rule.table,
          chain: rule.chain || "",
          rows: [],
        }
      group.rows.push(rule)
      groups.set(key, group)
    })

  return [...groups.values()]
}

function isBuiltInChain(table: TableName, chain: string) {
  return BUILT_IN_CHAINS[table].includes(chain)
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)]
}

function moveRuleByVisibleOrder<T extends { id: string; order: number }>(
  allRules: T[],
  visibleRows: T[],
  rule: T,
  direction: -1 | 1
) {
  const index = visibleRows.findIndex((item) => item.id === rule.id)
  const next = visibleRows[index + direction]
  if (!next) {
    return allRules
  }

  return allRules.map((item) => {
    if (item.id === rule.id) {
      return { ...item, order: next.order }
    }

    if (item.id === next.id) {
      return { ...item, order: rule.order }
    }

    return item
  })
}

function reorderRulesByVisibleDrop<T extends { id: string; order: number }>(
  allRules: T[],
  visibleRows: T[],
  activeId: string,
  overId: string
) {
  const activeIndex = visibleRows.findIndex((item) => item.id === activeId)
  const overIndex = visibleRows.findIndex((item) => item.id === overId)
  if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) {
    return allRules
  }

  const reordered = [...visibleRows]
  const [active] = reordered.splice(activeIndex, 1)
  reordered.splice(overIndex, 0, active)

  const orderById = new Map(
    reordered.map((item, index) => [item.id, visibleRows[index].order])
  )

  return allRules.map((item) => {
    const order = orderById.get(item.id)
    return order === undefined ? item : { ...item, order }
  })
}

function hasExternalChainReference(
  ruleset: Ruleset,
  table: TableName,
  chain: string
) {
  if (
    table === "filter" &&
    ruleset.filterRules.some(
      (rule) => rule.chain !== chain && rule.target === chain
    )
  ) {
    return true
  }

  return ruleset.rawRules.some(
    (rule) =>
      rule.table === table &&
      rule.chain !== chain &&
      rawRuleJumpsToChain(rule.line, chain)
  )
}

function rawRuleJumpsToChain(line: string, chain: string) {
  return new RegExp(
    `(?:^|\\s)(?:-j|--jump)\\s+${escapeRegExp(chain)}(?:\\s|$)`
  ).test(line)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function stripVolatile(rs: Ruleset) {
  const copy = clone(rs)
  delete copy.raw
  delete copy.warnings
  return copy
}

function readSessionToken() {
  const params = new URLSearchParams(window.location.search)
  const fromURL = params.get("token")?.trim()
  if (fromURL) {
    window.localStorage.setItem(SESSION_TOKEN_KEY, fromURL)
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.hash
    )
    return fromURL
  }

  return window.localStorage.getItem(SESSION_TOKEN_KEY) ?? ""
}

function errorCopy(t: TFunction): ErrorCopy {
  return {
    unknownError: t("unknownError"),
    snapshotDriftTitle: t("snapshotDriftTitle"),
    snapshotDriftHint: t("snapshotDriftHint"),
    useMockModeHint: t("useMockModeHint"),
  }
}

function formatErrorDisplay(err: unknown, copy: ErrorCopy): ErrorDisplay {
  if (isSnapshotDriftError(err)) {
    return {
      title: copy.snapshotDriftTitle,
      description: copy.snapshotDriftHint,
    }
  }

  const title = formatError(err, copy.unknownError)
  if (isCommandsUnavailableError(err)) {
    return {
      title,
      description: copy.useMockModeHint,
    }
  }

  return { title }
}

function errorToastDescription(error: ErrorDisplay) {
  return error.description ? `${error.title} ${error.description}` : error.title
}

function formatError(err: unknown, fallback = "Unknown error") {
  if (err instanceof ApiError) {
    return `${err.status}: ${err.message}`
  }

  if (err instanceof Error) {
    return err.message
  }

  return fallback
}

function isSnapshotDriftError(err: unknown) {
  return (
    err instanceof ApiError &&
    err.status === 409 &&
    err.message.includes(SNAPSHOT_DRIFT_MESSAGE)
  )
}

function isCommandsUnavailableError(err: unknown) {
  return (
    (err instanceof ApiError && err.status === 503) ||
    (err instanceof Error && err.message.includes(COMMANDS_UNAVAILABLE_MESSAGE))
  )
}

function targetTone(target: string): BadgeTone {
  if (target === "ACCEPT") return "success"
  if (target === "DROP") return "danger"
  return "warning"
}

function confirmMeta(action: ConfirmAction, t: TFunction) {
  if (action === "apply") {
    return {
      title: t("confirmApplyTitle"),
      description: t("confirmApplyDescription"),
      confirmLabel: t("confirmApplyLabel"),
    }
  }

  if (action === "rollback") {
    return {
      title: t("confirmRollbackTitle"),
      description: t("confirmRollbackDescription"),
      confirmLabel: t("confirmRollbackLabel"),
    }
  }

  if (action === "shutdown") {
    return {
      title: t("confirmShutdownTitle"),
      description: t("confirmShutdownDescription"),
      confirmLabel: t("confirmShutdownLabel"),
    }
  }

  if (action === "refresh") {
    return {
      title: t("confirmRefreshTitle"),
      description: t("confirmRefreshDescription"),
      confirmLabel: t("confirmRefreshLabel"),
    }
  }

  return {
    title: t("confirmActionTitle"),
    description: "",
    confirmLabel: t("confirmActionLabel"),
  }
}

function actionTitle(action: ConfirmAction, t: TFunction) {
  if (action === "apply") return t("applyFailed")
  if (action === "rollback") return t("rollbackFailed")
  if (action === "shutdown") return t("shutdownFailed")
  if (action === "refresh") return t("toastRefreshFailedTitle")
  return t("actionFailed")
}

function NatRuleDialog({
  editor,
  ruleset,
  nextOrderValue,
  onClose,
  onSave,
}: {
  editor: NatEditor
  ruleset: Ruleset
  nextOrderValue: number
  onClose: () => void
  onSave: (rule: NatRule) => void
}) {
  const { t, translateValidationMessage } = useI18n()
  const existing = editor?.mode === "edit" ? editor.rule : undefined
  const chainOptions = useMemo(() => tableChainNames(ruleset, "nat"), [ruleset])
  const initialCreateType =
    editor?.mode === "create" && editor.initialChain === "POSTROUTING"
      ? "masquerade"
      : "port-forward"
  const [createType, setCreateType] =
    useState<NatRule["type"]>(initialCreateType)
  const ruleType = existing?.type ?? createType
  const defaultChain = preferredChain(
    chainOptions,
    ruleType === "masquerade" ? "POSTROUTING" : "PREROUTING"
  )
  const initialChain =
    editor?.mode === "create" &&
    editor.initialChain &&
    chainOptions.includes(editor.initialChain)
      ? editor.initialChain
      : undefined
  const [form, setForm] = useState<NatRuleFormState>({
    chain: existing?.chain ?? initialChain ?? defaultChain,
    protocol: existing?.protocol === "udp" ? "udp" : "tcp",
    listenPort: existing?.listenPort ?? "",
    destinationIp: existing?.destinationIp ?? "",
    destinationPort: existing?.destinationPort ?? "",
    sourceCidr: existing?.sourceCidr ?? "",
    inInterface: existing?.inInterface ?? "",
    outInterface: existing?.outInterface ?? "",
    comment: existing?.comment ?? "",
  })
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    if (!chainOptions.includes(form.chain)) {
      setForm((current) => ({ ...current, chain: defaultChain }))
    }
  }, [chainOptions, defaultChain, form.chain])

  function updateCreateType(value: NatRule["type"]) {
    const previousDefaultChain = preferredChain(
      chainOptions,
      createType === "masquerade" ? "POSTROUTING" : "PREROUTING"
    )
    const nextDefaultChain = preferredChain(
      chainOptions,
      value === "masquerade" ? "POSTROUTING" : "PREROUTING"
    )

    setCreateType(value)
    setErrors([])
    setForm((current) => ({
      ...current,
      chain:
        current.chain === previousDefaultChain
          ? nextDefaultChain
          : current.chain,
    }))
  }

  function save() {
    if (!editor) return

    if (ruleType === "port-forward") {
      const parsed = portForwardSchema(chainOptions).safeParse({
        chain: form.chain,
        protocol: form.protocol,
        listenPort: form.listenPort,
        destinationIp: form.destinationIp,
        destinationPort: form.destinationPort,
        sourceCidr: form.sourceCidr,
        inInterface: form.inInterface,
        comment: form.comment,
      })
      if (!parsed.success) {
        setErrors(zodMessages(parsed.error, translateValidationMessage))
        return
      }

      const value = parsed.data
      onSave({
        id: existing?.id ?? newId("nat"),
        type: "port-forward",
        table: "nat",
        chain: value.chain,
        protocol: value.protocol,
        listenPort: value.listenPort,
        destinationIp: value.destinationIp,
        destinationPort: value.destinationPort,
        sourceCidr: compact(value.sourceCidr),
        inInterface: compact(value.inInterface),
        comment: compact(value.comment),
        target: "DNAT",
        toDestination: `${value.destinationIp}:${value.destinationPort}`,
        order: existing?.order ?? nextOrderValue,
        readOnly: existing?.readOnly ?? false,
        extra: existing?.extra,
      })
      return
    }

    const parsed = masqueradeSchema(chainOptions).safeParse({
      chain: form.chain,
      sourceCidr: form.sourceCidr,
      outInterface: form.outInterface,
      comment: form.comment,
    })
    if (!parsed.success) {
      setErrors(zodMessages(parsed.error, translateValidationMessage))
      return
    }

    const value = parsed.data
    onSave({
      id: existing?.id ?? newId("nat"),
      type: "masquerade",
      table: "nat",
      chain: value.chain,
      sourceCidr: compact(value.sourceCidr),
      outInterface: compact(value.outInterface),
      comment: compact(value.comment),
      target: "MASQUERADE",
      order: existing?.order ?? nextOrderValue,
      readOnly: existing?.readOnly ?? false,
      extra: existing?.extra,
    })
  }

  return (
    <Dialog open={editor !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {existing ? t("editNatRule") : t("addNatRule")}
          </DialogTitle>
          <DialogDescription>
            {existing
              ? t("natRuleDialogDescription")
              : t("createNatRuleDialogDescription")}
          </DialogDescription>
        </DialogHeader>
        {existing ? null : (
          <SelectField
            label={t("fieldNatRuleType")}
            value={createType}
            onValueChange={(value) => updateCreateType(value as NatRule["type"])}
            options={["port-forward", "masquerade"]}
            formatOption={(option) =>
              option === "port-forward" ? t("portForwardTitle") : "MASQUERADE"
            }
          />
        )}
        {ruleType === "port-forward" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SelectField
              label={t("fieldChain")}
              value={form.chain}
              onValueChange={(value) => setForm({ ...form, chain: value })}
              options={chainOptions}
            />
            <SelectField
              label={t("fieldProtocol")}
              value={form.protocol}
              onValueChange={(value) =>
                setForm({ ...form, protocol: value as "tcp" | "udp" })
              }
              options={["tcp", "udp"]}
            />
            <TextField
              label={t("fieldListenPort")}
              value={form.listenPort}
              onChange={(value) => setForm({ ...form, listenPort: value })}
              inputMode="numeric"
            />
            <TextField
              label={t("fieldDestinationIp")}
              value={form.destinationIp}
              onChange={(value) => setForm({ ...form, destinationIp: value })}
              placeholder="10.0.0.20"
            />
            <TextField
              label={t("fieldDestinationPort")}
              value={form.destinationPort}
              onChange={(value) =>
                setForm({ ...form, destinationPort: value })
              }
              inputMode="numeric"
            />
            <TextField
              label={t("fieldSourceCidr")}
              value={form.sourceCidr}
              onChange={(value) => setForm({ ...form, sourceCidr: value })}
              placeholder={t("optionalPlaceholder")}
            />
            <TextField
              label={t("fieldInputInterface")}
              value={form.inInterface}
              onChange={(value) => setForm({ ...form, inInterface: value })}
              placeholder={t("optionalPlaceholder")}
            />
            <div className="sm:col-span-2 lg:col-span-3">
              <TextField
                label={t("fieldComment")}
                value={form.comment}
                onChange={(value) => setForm({ ...form, comment: value })}
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label={t("fieldChain")}
              value={form.chain}
              onValueChange={(value) => setForm({ ...form, chain: value })}
              options={chainOptions}
            />
            <TextField
              label={t("fieldSourceCidr")}
              value={form.sourceCidr}
              onChange={(value) => setForm({ ...form, sourceCidr: value })}
              placeholder="10.0.0.0/24"
            />
            <TextField
              label={t("fieldOutputInterface")}
              value={form.outInterface}
              onChange={(value) => setForm({ ...form, outInterface: value })}
              placeholder="eth0"
            />
            <TextField
              label={t("fieldComment")}
              value={form.comment}
              onChange={(value) => setForm({ ...form, comment: value })}
            />
          </div>
        )}
        <ErrorList errors={errors} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button onClick={save}>
            <Save className="size-4" />
            {t("saveRule")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default App
