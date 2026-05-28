import {
  Component,
  useCallback,
  useEffect,
  useMemo,
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
import {
  compact,
  clone,
  cn,
  isEqualJSON,
  newId,
  nextOrder,
  reorder,
} from "@/lib/utils"
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
type ConfirmAction = "apply" | "rollback" | "shutdown" | "refresh" | null
type FilterEditor = { mode: "create" | "edit"; rule?: FilterRule } | null
type BadgeTone = "default" | "success" | "warning" | "danger" | "muted"
type FilterProtocolOption = "any" | "tcp" | "udp" | "icmp"
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

const SESSION_TOKEN_KEY = "iptables-config-ui-session-token"

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
      return (
        <main className="min-h-svh bg-background p-4">
          <Alert variant="destructive" className="mx-auto max-w-3xl">
            <AlertTriangle className="size-4" />
            <AlertTitle>UI render failed</AlertTitle>
            <AlertDescription>{this.state.error.message}</AlertDescription>
          </Alert>
        </main>
      )
    }

    return this.props.children
  }
}

function FirewallApp() {
  const [system, setSystem] = useState<SystemStatus | null>(null)
  const [rules, setRules] = useState<Ruleset | null>(null)
  const [draft, setDraft] = useState<Ruleset | null>(null)
  const [token, setToken] = useState("")
  const [activeTab, setActiveTab] = useState<Tab>("overview")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterEditor, setFilterEditor] = useState<FilterEditor>(null)
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

  const boot = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const sessionToken = readSessionToken()
      setToken(sessionToken)

      const status = await api.system()
      setSystem(status)

      const response = await api.rules()
      setRules(response.ruleset)
      setDraft(clone(response.ruleset))
    } catch (err) {
      const message = formatError(err)
      setError(message)
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
      const [status, response] = await Promise.all([api.system(), api.rules()])
      setSystem(status)
      setRules(response.ruleset)
      setDraft(clone(response.ruleset))
      toast.success("Rules refreshed", {
        description: "Loaded the current live iptables snapshot.",
      })
    } catch (err) {
      const message = formatError(err)
      setError(message)
      toast.error("Refresh failed", { description: message })
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
        toast.warning("Draft is invalid", {
          description: validation.errors.join(" "),
        })
        return false
      }

      toast.success("Draft is valid", {
        description: "The server accepted the current ruleset.",
      })
      return true
    } catch (err) {
      const message = formatError(err)
      setError(message)
      toast.error("Validation failed", { description: message })
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
          toast.warning("Draft is invalid", {
            description: validation.errors.join(" "),
          })
          return
        }

        const response = await api.apply(token, rules.snapshotId, draft)
        setRules(response.ruleset)
        setDraft(clone(response.ruleset))
        toast.success("Rules applied", {
          description: "Live iptables rules were updated.",
        })
      }

      if (action === "rollback") {
        const response = await api.rollback(token)
        setRules(response.ruleset)
        setDraft(clone(response.ruleset))
        toast.success("Rollback restored", {
          description: "The previous in-memory snapshot is active again.",
        })
      }

      if (action === "shutdown") {
        await api.shutdown(token)
        toast.success("Server shutting down", {
          description: "The local Go service accepted the shutdown request.",
        })
      }
    } catch (err) {
      const message = formatError(err)
      setError(message)
      toast.error(actionTitle(action), { description: message })
    } finally {
      setBusy(false)
      setConfirmAction(null)
    }
  }

  function updateDraft(next: Ruleset) {
    setDraft(next)
  }

  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 p-3 sm:p-4 lg:p-6">
        <header className="flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-center lg:justify-between">
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
                  : "Loading host status"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={system?.mock ? "warning" : "success"}>
              {system?.mock ? "Mock mode" : "Live mode"}
            </StatusBadge>
            <StatusBadge tone={system?.root ? "success" : "warning"}>
              {system?.root ? "root" : "non-root"}
            </StatusBadge>
            <StatusBadge tone={commandsMissing ? "danger" : "success"}>
              {commandsMissing ? "commands missing" : "commands ready"}
            </StatusBadge>
            <StatusBadge tone={pending ? "warning" : "muted"}>
              {pendingCount} pending
            </StatusBadge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => void refreshRules(false)}
              disabled={busy || loading}
            >
              <RefreshCw className={cn("size-4", busy && "animate-spin")} />
              Refresh
            </Button>
            <Button
              variant="secondary"
              onClick={() => void validateDraft()}
              disabled={!canValidate}
            >
              <ClipboardCheck className="size-4" />
              Validate
            </Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              onClick={() => setConfirmAction("apply")}
              disabled={!canMutate || !pending}
            >
              <Save className="size-4" />
              Apply
            </Button>
            <Button
              variant="outline"
              onClick={() => setConfirmAction("rollback")}
              disabled={!canMutate}
            >
              <RotateCcw className="size-4" />
              Rollback
            </Button>
            <Button
              variant="destructive"
              onClick={() => setConfirmAction("shutdown")}
              disabled={!token || busy}
            >
              <Power className="size-4" />
              Shutdown
            </Button>
            <ThemeToggle />
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
            <AlertTitle>{error}</AlertTitle>
            <AlertDescription>
              Use mock mode for local development when iptables is unavailable.
            </AlertDescription>
          </Alert>
        ) : null}

        {!token ? (
          <Alert className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
            <AlertTriangle className="size-4" />
            <AlertTitle>Session token is missing</AlertTitle>
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              Open the URL printed by the server with the token query string, or
              paste the token in Overview before mutating rules.
            </AlertDescription>
          </Alert>
        ) : null}

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as Tab)}
        >
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="filter">Filter</TabsTrigger>
            <TabsTrigger value="nat">NAT</TabsTrigger>
            <TabsTrigger value="raw">Raw</TabsTrigger>
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
                onCreate={() => setFilterEditor({ mode: "create" })}
                onEdit={(rule) => setFilterEditor({ mode: "edit", rule })}
              />
            ) : null}
          </TabsContent>

          <TabsContent value="nat" className="mt-4">
            {loading ? (
              <LoadingPanel />
            ) : draft ? (
              <NatPanel ruleset={draft} onChange={updateDraft} />
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
          key={filterEditor?.rule?.id ?? filterEditor?.mode ?? "closed"}
          editor={filterEditor}
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
              filterEditor?.mode === "edit" ? "Rule updated" : "Rule added"
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
  const items = [
    { label: "Listen address", value: system?.addr ?? "127.0.0.1:8921" },
    {
      label: "Snapshot",
      value: rules?.snapshotId ? rules.snapshotId.slice(0, 12) : "unavailable",
    },
    { label: "Filter rules", value: String(draft?.filterRules.length ?? 0) },
    { label: "NAT rules", value: String(draft?.natRules.length ?? 0) },
    { label: "Raw lines", value: String(draft?.rawRules.length ?? 0) },
    { label: "Pending changes", value: String(pendingCount) },
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
  const [value, setValue] = useState(token)

  function saveToken() {
    const next = value.trim()
    onTokenChange(next)
    if (next) {
      window.localStorage.setItem(SESSION_TOKEN_KEY, next)
      toast.success("Session token saved")
      return
    }

    window.localStorage.removeItem(SESSION_TOKEN_KEY)
    toast.info("Session token cleared")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Session</CardTitle>
        <CardDescription>Token-protected API actions</CardDescription>
        <CardAction>
          <StatusBadge tone={token ? "success" : "warning"}>
            {token ? "ready" : "missing"}
          </StatusBadge>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="grid gap-2">
          <Label htmlFor="session-token">Session token</Label>
          <Input
            id="session-token"
            type="password"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Paste token from server log"
            autoComplete="off"
          />
        </div>
        <div className="flex items-end">
          <Button onClick={saveToken} className="w-full sm:w-auto">
            <Save className="size-4" />
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function CapabilitiesCard({ system }: { system: SystemStatus | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Capabilities</CardTitle>
        <CardDescription>Server-reported firewall features</CardDescription>
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
            No capabilities reported.
          </span>
        )}
      </CardContent>
    </Card>
  )
}

function CommandStatusCard({ commands }: { commands: CommandStatus[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Commands</CardTitle>
        <CardDescription>Host iptables tool availability</CardDescription>
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
                  {command.path || command.error || "not found"}
                </div>
              </div>
              <StatusBadge tone={command.available ? "success" : "danger"}>
                {command.available ? "available" : "missing"}
              </StatusBadge>
            </div>
          ))
        ) : (
          <div className="text-sm text-muted-foreground">
            No command status loaded.
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DraftSummaryCard({ draft }: { draft: Ruleset | null }) {
  const warnings = draft?.warnings ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Draft</CardTitle>
        <CardDescription>Current editable ruleset</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <SummaryItem label="Policies" value={draft?.policies.length ?? 0} />
          <SummaryItem label="Filter" value={draft?.filterRules.length ?? 0} />
          <SummaryItem label="NAT" value={draft?.natRules.length ?? 0} />
          <SummaryItem label="Raw" value={draft?.rawRules.length ?? 0} />
        </div>
        {warnings.length ? (
          <Alert className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
            <AlertTriangle className="size-4" />
            <AlertTitle>{warnings.length} parser warning(s)</AlertTitle>
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              Unsupported lines are preserved in Raw.
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
  onCreate: () => void
  onEdit: (rule: FilterRule) => void
}) {
  const rows = useMemo(
    () => [...ruleset.filterRules].sort((a, b) => a.order - b.order),
    [ruleset.filterRules]
  )

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
    (rule: FilterRule, direction: -1 | 1) => {
      const index = rows.findIndex((item) => item.id === rule.id)
      onChange({ ...ruleset, filterRules: reorder(rows, index, direction) })
    },
    [onChange, rows, ruleset]
  )

  const columns = useMemo<ColumnDef<FilterRule>[]>(
    () => [
      {
        header: "Chain",
        accessorKey: "chain",
        size: 90,
      },
      {
        header: "Target",
        cell: ({ row }) => (
          <StatusBadge tone={targetTone(row.original.target)}>
            {row.original.target}
          </StatusBadge>
        ),
        size: 96,
      },
      {
        header: "Match",
        cell: ({ row }) => <RuleMatch rule={row.original} />,
      },
      {
        header: "Comment",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.comment || "-"}
          </span>
        ),
      },
      {
        header: "Actions",
        cell: ({ row }) => {
          const index = rows.findIndex((item) => item.id === row.original.id)
          return (
            <div className="flex items-center justify-end gap-1">
              <IconButton
                label="Move rule up"
                onClick={() => move(row.original, -1)}
                disabled={index <= 0}
              >
                <ChevronUp className="size-4" />
              </IconButton>
              <IconButton
                label="Move rule down"
                onClick={() => move(row.original, 1)}
                disabled={index >= rows.length - 1}
              >
                <ChevronDown className="size-4" />
              </IconButton>
              <IconButton
                label="Edit rule"
                onClick={() => onEdit(row.original)}
              >
                <Edit3 className="size-4" />
              </IconButton>
              <IconButton
                label="Delete rule"
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
    [move, onEdit, remove, rows]
  )

  return (
    <section className="space-y-4">
      <PoliciesEditor ruleset={ruleset} onChange={onChange} table="filter" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-normal">
            Filter Rules
          </h2>
          <p className="text-sm text-muted-foreground">
            Editable IPv4 INPUT, OUTPUT, and FORWARD rules.
          </p>
        </div>
        <Button onClick={onCreate}>
          <Plus className="size-4" />
          Add rule
        </Button>
      </div>
      <DataTable
        data={rows}
        columns={columns}
        empty="No editable filter rules in this snapshot."
      />
    </section>
  )
}

function PoliciesEditor({
  ruleset,
  onChange,
  table,
}: {
  ruleset: Ruleset
  onChange: (ruleset: Ruleset) => void
  table: "filter" | "nat"
}) {
  const policies = [...ruleset.policies]
    .filter((policy) => policy.table === table)
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
          {table === "filter" ? "Default Policies" : "NAT Policies"}
        </h2>
        <p className="text-sm text-muted-foreground">
          Chain policy lines are included when applying the draft.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-4">
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
                <SelectItem value="ACCEPT">ACCEPT</SelectItem>
                <SelectItem value="DROP">DROP</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  )
}

function NatPanel({
  ruleset,
  onChange,
}: {
  ruleset: Ruleset
  onChange: (ruleset: Ruleset) => void
}) {
  const rows = useMemo(
    () => [...ruleset.natRules].sort((a, b) => a.order - b.order),
    [ruleset.natRules]
  )

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
    (rule: NatRule, direction: -1 | 1) => {
      const index = rows.findIndex((item) => item.id === rule.id)
      onChange({ ...ruleset, natRules: reorder(rows, index, direction) })
    },
    [onChange, rows, ruleset]
  )

  function addRule(rule: NatRule) {
    onChange({ ...ruleset, natRules: [...ruleset.natRules, rule] })
  }

  const columns = useMemo<ColumnDef<NatRule>[]>(
    () => [
      {
        header: "Type",
        cell: ({ row }) => (
          <StatusBadge
            tone={row.original.type === "port-forward" ? "warning" : "success"}
          >
            {row.original.type}
          </StatusBadge>
        ),
        size: 130,
      },
      {
        header: "Match",
        cell: ({ row }) =>
          row.original.type === "port-forward" ? (
            <span className="font-mono text-xs">
              {row.original.protocol}/{row.original.listenPort} -&gt;{" "}
              {row.original.destinationIp}:{row.original.destinationPort}
            </span>
          ) : (
            <span className="font-mono text-xs">
              source {row.original.sourceCidr || "any"} -&gt;{" "}
              {row.original.outInterface || "any iface"}
            </span>
          ),
      },
      {
        header: "Scope",
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
        header: "Comment",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.comment || "-"}
          </span>
        ),
      },
      {
        header: "Actions",
        cell: ({ row }) => {
          const index = rows.findIndex((item) => item.id === row.original.id)
          return (
            <div className="flex items-center justify-end gap-1">
              <IconButton
                label="Move NAT rule up"
                onClick={() => move(row.original, -1)}
                disabled={index <= 0}
              >
                <ChevronUp className="size-4" />
              </IconButton>
              <IconButton
                label="Move NAT rule down"
                onClick={() => move(row.original, 1)}
                disabled={index >= rows.length - 1}
              >
                <ChevronDown className="size-4" />
              </IconButton>
              <IconButton
                label="Delete NAT rule"
                onClick={() => remove(row.original)}
              >
                <Trash2 className="size-4" />
              </IconButton>
            </div>
          )
        },
        size: 146,
      },
    ],
    [move, remove, rows]
  )

  return (
    <section className="space-y-4">
      <PoliciesEditor ruleset={ruleset} onChange={onChange} table="nat" />
      <div className="grid gap-4 lg:grid-cols-2">
        <PortForwardForm order={nextOrder(ruleset.natRules)} onAdd={addRule} />
        <MasqueradeForm order={nextOrder(ruleset.natRules)} onAdd={addRule} />
      </div>
      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold tracking-normal">
            NAT / Port Forward
          </h2>
          <p className="text-sm text-muted-foreground">
            Structured PREROUTING DNAT and POSTROUTING MASQUERADE rules.
          </p>
        </div>
        <DataTable
          data={rows}
          columns={columns}
          empty="No editable NAT rules in this snapshot."
        />
      </div>
    </section>
  )
}

function RawPanel({ ruleset }: { ruleset: Ruleset }) {
  const columns = useMemo<ColumnDef<RawRule>[]>(
    () => [
      { header: "Table", accessorKey: "table", size: 90 },
      { header: "Chain", accessorKey: "chain", size: 120 },
      {
        header: "Line",
        cell: ({ row }) => (
          <code className="block min-w-80 font-mono text-xs whitespace-nowrap">
            {row.original.line}
          </code>
        ),
      },
      {
        header: "Reason",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.reason}
          </span>
        ),
      },
    ],
    []
  )

  const rawRows = [...ruleset.rawRules].sort(
    (a, b) => a.table.localeCompare(b.table) || a.order - b.order
  )

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-normal">
            Raw / Read-only
          </h2>
          <p className="text-sm text-muted-foreground">
            Unsupported rules are preserved during apply and shown for review.
          </p>
        </div>
        <StatusBadge tone="muted">
          {ruleset.rawRules.length} read-only
        </StatusBadge>
      </div>
      <DataTable
        data={rawRows}
        columns={columns}
        empty="No unsupported rules detected."
      />
      <div className="grid gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Terminal className="size-4" />
          iptables-save snapshot
        </div>
        <ScrollArea className="h-[420px] rounded-lg border bg-zinc-950 p-3 text-zinc-50">
          <pre className="min-w-max font-mono text-xs leading-relaxed">
            {ruleset.raw || "No raw snapshot available."}
          </pre>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </section>
  )
}

function FilterRuleDialog({
  editor,
  nextOrderValue,
  onClose,
  onSave,
}: {
  editor: FilterEditor
  nextOrderValue: number
  onClose: () => void
  onSave: (rule: FilterRule) => void
}) {
  const existing = editor?.rule
  const [form, setForm] = useState<FilterRuleFormState>({
    chain: existing?.chain ?? "INPUT",
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
    const parsed = filterRuleSchema.safeParse(form)
    if (!parsed.success) {
      setErrors(zodMessages(parsed.error))
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
            {editor?.mode === "edit" ? "Edit filter rule" : "Add filter rule"}
          </DialogTitle>
          <DialogDescription>
            Create a structured IPv4 filter rule for INPUT, OUTPUT, or FORWARD.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SelectField
            label="Chain"
            value={form.chain}
            onValueChange={(value) =>
              setForm({ ...form, chain: value as FilterRule["chain"] })
            }
            options={["INPUT", "OUTPUT", "FORWARD"]}
          />
          <SelectField
            label="Target"
            value={form.target}
            onValueChange={(value) =>
              setForm({ ...form, target: value as FilterRule["target"] })
            }
            options={["ACCEPT", "DROP", "REJECT"]}
          />
          <SelectField
            label="Protocol"
            value={form.protocol}
            onValueChange={(value) =>
              setForm({
                ...form,
                protocol: value as FilterProtocolOption,
              })
            }
            options={["any", "tcp", "udp", "icmp"]}
          />
          <TextField
            label="Source"
            value={form.source}
            onChange={(value) => setForm({ ...form, source: value })}
            placeholder="10.0.0.0/24"
          />
          <TextField
            label="Destination"
            value={form.destination}
            onChange={(value) => setForm({ ...form, destination: value })}
            placeholder="192.168.1.10"
          />
          <TextField
            label="Input interface"
            value={form.inInterface}
            onChange={(value) => setForm({ ...form, inInterface: value })}
            placeholder="eth0"
          />
          <TextField
            label="Output interface"
            value={form.outInterface}
            onChange={(value) => setForm({ ...form, outInterface: value })}
            placeholder="eth1"
          />
          <TextField
            label="Source port"
            value={form.sourcePort}
            onChange={(value) => setForm({ ...form, sourcePort: value })}
            inputMode="numeric"
          />
          <TextField
            label="Destination port"
            value={form.destinationPort}
            onChange={(value) => setForm({ ...form, destinationPort: value })}
            inputMode="numeric"
          />
          <div className="sm:col-span-2 lg:col-span-3">
            <TextField
              label="Comment"
              value={form.comment}
              onChange={(value) => setForm({ ...form, comment: value })}
              placeholder="SSH admin"
            />
          </div>
        </div>
        <ErrorList errors={errors} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>
            <Save className="size-4" />
            Save rule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PortForwardForm({
  order,
  onAdd,
}: {
  order: number
  onAdd: (rule: NatRule) => void
}) {
  const [form, setForm] = useState({
    protocol: "tcp",
    listenPort: "",
    destinationIp: "",
    destinationPort: "",
    sourceCidr: "",
    inInterface: "",
    comment: "",
  })
  const [errors, setErrors] = useState<string[]>([])

  function add() {
    const parsed = portForwardSchema.safeParse(form)
    if (!parsed.success) {
      setErrors(zodMessages(parsed.error))
      return
    }

    const value = parsed.data
    onAdd({
      id: newId("nat"),
      type: "port-forward",
      table: "nat",
      chain: "PREROUTING",
      protocol: value.protocol,
      listenPort: value.listenPort,
      destinationIp: value.destinationIp,
      destinationPort: value.destinationPort,
      sourceCidr: compact(value.sourceCidr),
      inInterface: compact(value.inInterface),
      comment: compact(value.comment),
      target: "DNAT",
      order,
      readOnly: false,
    })
    setForm({
      protocol: "tcp",
      listenPort: "",
      destinationIp: "",
      destinationPort: "",
      sourceCidr: "",
      inInterface: "",
      comment: "",
    })
    setErrors([])
    toast.success("Port forward added")
  }

  return (
    <div className="grid gap-4 rounded-lg border bg-card p-4">
      <div>
        <h2 className="text-base font-semibold tracking-normal">
          Port forward
        </h2>
        <p className="text-sm text-muted-foreground">
          DNAT into an internal host.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <SelectField
          label="Protocol"
          value={form.protocol}
          onValueChange={(value) =>
            setForm({ ...form, protocol: value as "tcp" | "udp" })
          }
          options={["tcp", "udp"]}
        />
        <TextField
          label="Listen port"
          value={form.listenPort}
          onChange={(value) => setForm({ ...form, listenPort: value })}
          inputMode="numeric"
        />
        <TextField
          label="Destination IP"
          value={form.destinationIp}
          onChange={(value) => setForm({ ...form, destinationIp: value })}
          placeholder="10.0.0.20"
        />
        <TextField
          label="Destination port"
          value={form.destinationPort}
          onChange={(value) => setForm({ ...form, destinationPort: value })}
          inputMode="numeric"
        />
        <TextField
          label="Source CIDR"
          value={form.sourceCidr}
          onChange={(value) => setForm({ ...form, sourceCidr: value })}
          placeholder="optional"
        />
        <TextField
          label="Input interface"
          value={form.inInterface}
          onChange={(value) => setForm({ ...form, inInterface: value })}
          placeholder="optional"
        />
      </div>
      <TextField
        label="Comment"
        value={form.comment}
        onChange={(value) => setForm({ ...form, comment: value })}
      />
      <ErrorList errors={errors} />
      <div>
        <Button onClick={add}>
          <Plus className="size-4" />
          Add forward
        </Button>
      </div>
    </div>
  )
}

function MasqueradeForm({
  order,
  onAdd,
}: {
  order: number
  onAdd: (rule: NatRule) => void
}) {
  const [form, setForm] = useState({
    sourceCidr: "",
    outInterface: "",
    comment: "",
  })
  const [errors, setErrors] = useState<string[]>([])

  function add() {
    const parsed = masqueradeSchema.safeParse(form)
    if (!parsed.success) {
      setErrors(zodMessages(parsed.error))
      return
    }

    const value = parsed.data
    onAdd({
      id: newId("nat"),
      type: "masquerade",
      table: "nat",
      chain: "POSTROUTING",
      sourceCidr: compact(value.sourceCidr),
      outInterface: compact(value.outInterface),
      comment: compact(value.comment),
      target: "MASQUERADE",
      order,
      readOnly: false,
    })
    setForm({ sourceCidr: "", outInterface: "", comment: "" })
    setErrors([])
    toast.success("MASQUERADE rule added")
  }

  return (
    <div className="grid gap-4 rounded-lg border bg-card p-4">
      <div>
        <h2 className="text-base font-semibold tracking-normal">MASQUERADE</h2>
        <p className="text-sm text-muted-foreground">
          Source NAT for egress traffic.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="Source CIDR"
          value={form.sourceCidr}
          onChange={(value) => setForm({ ...form, sourceCidr: value })}
          placeholder="10.0.0.0/24"
        />
        <TextField
          label="Output interface"
          value={form.outInterface}
          onChange={(value) => setForm({ ...form, outInterface: value })}
          placeholder="eth0"
        />
      </div>
      <TextField
        label="Comment"
        value={form.comment}
        onChange={(value) => setForm({ ...form, comment: value })}
      />
      <ErrorList errors={errors} />
      <div>
        <Button variant="secondary" onClick={add}>
          <Plus className="size-4" />
          Add masquerade
        </Button>
      </div>
    </div>
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
  const meta = confirmMeta(action)

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
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
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
}: {
  label: string
  value: string
  onValueChange: (value: string) => void
  options: string[]
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
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function ErrorList({ errors }: { errors: string[] }) {
  if (!errors.length) return null

  return (
    <Alert variant="destructive">
      <AlertTriangle className="size-4" />
      <AlertTitle>Fix validation errors</AlertTitle>
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
  const parts = [
    rule.protocol ? `proto:${rule.protocol}` : "proto:any",
    rule.source ? `src:${rule.source}` : "",
    rule.destination ? `dst:${rule.destination}` : "",
    rule.inInterface ? `in:${rule.inInterface}` : "",
    rule.outInterface ? `out:${rule.outInterface}` : "",
    rule.sourcePort ? `sport:${rule.sourcePort}` : "",
    rule.destinationPort ? `dport:${rule.destinationPort}` : "",
  ].filter(Boolean)

  return <span className="font-mono text-xs">{parts.join(" ")}</span>
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

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const isDark = theme === "dark"

  return (
    <IconButton
      label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </IconButton>
  )
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

function formatError(err: unknown) {
  if (err instanceof ApiError) {
    return `${err.status}: ${err.message}`
  }

  if (err instanceof Error) {
    return err.message
  }

  return "Unknown error"
}

function targetTone(target: string): BadgeTone {
  if (target === "ACCEPT") return "success"
  if (target === "DROP") return "danger"
  return "warning"
}

function confirmMeta(action: ConfirmAction) {
  if (action === "apply") {
    return {
      title: "Apply firewall draft",
      description:
        "This replaces live IPv4 iptables rules with the current draft. The server keeps one in-memory rollback snapshot while this process is running.",
      confirmLabel: "Apply rules",
    }
  }

  if (action === "rollback") {
    return {
      title: "Rollback last apply",
      description:
        "This restores the in-memory snapshot captured before the last successful apply.",
      confirmLabel: "Rollback",
    }
  }

  if (action === "shutdown") {
    return {
      title: "Shutdown local server",
      description: "This stops the Go process serving the UI and firewall API.",
      confirmLabel: "Shutdown",
    }
  }

  if (action === "refresh") {
    return {
      title: "Discard draft changes",
      description:
        "Refreshing will discard the current draft and load a fresh snapshot from live iptables.",
      confirmLabel: "Discard and refresh",
    }
  }

  return {
    title: "Confirm action",
    description: "",
    confirmLabel: "Confirm",
  }
}

function actionTitle(action: ConfirmAction) {
  if (action === "apply") return "Apply failed"
  if (action === "rollback") return "Rollback failed"
  if (action === "shutdown") return "Shutdown failed"
  if (action === "refresh") return "Refresh failed"
  return "Action failed"
}

export default App
