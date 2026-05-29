import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  ClipboardCheck,
  Power,
  RefreshCw,
  RotateCcw,
  Save,
  Shield,
} from "lucide-react"
import { toast } from "sonner"

import { api } from "@/api"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useI18n } from "@/lib/i18n"
import { clone, cn, isEqualJSON, nextOrder } from "@/lib/utils"
import type { Ruleset, SystemStatus } from "@/types/firewall"

import { ConfirmActionDialog } from "./components/confirm-action-dialog"
import { DiagnosticsPanel } from "./pages/diagnostics-page"
import { FilterRuleDialog } from "./components/filter-rule-dialog"
import { LanguageSelect } from "./components/language-select"
import { LoadingPanel } from "./components/loading-panel"
import { NatRuleDialog } from "./components/nat-rule-dialog"
import { StatusBadge } from "./components/status-badge"
import { StatusCards } from "./components/status-cards"
import { ThemeToggle } from "./components/theme-toggle"
import { emptyRuleset } from "./constants"
import {
  actionTitle,
  errorCopy,
  errorToastDescription,
  formatErrorDisplay,
  isSnapshotDriftError,
} from "./errors"
import { FilterRulesPanel } from "./pages/filter-page"
import { NatPanel } from "./pages/nat-page"
import { OverviewPanel } from "./pages/overview-page"
import { RawPanel } from "./pages/raw-page"
import { stripVolatile } from "./rules"
import { readSessionToken } from "./session"
import type {
  ConfirmAction,
  ErrorDisplay,
  FilterEditor,
  NatEditor,
  Tab,
} from "./types"

export function FirewallApp() {
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
            <TabsTrigger value="diagnostics">{t("tabDiagnostics")}</TabsTrigger>
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

          <TabsContent value="diagnostics" className="mt-4">
            {loading ? (
              <LoadingPanel />
            ) : draft ? (
              <DiagnosticsPanel ruleset={draft} />
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
