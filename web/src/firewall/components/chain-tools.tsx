import { useMemo, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useI18n } from "@/lib/i18n"
import { newId, nextOrder } from "@/lib/utils"
import type { Policy, Ruleset } from "@/types/firewall"

import { ALL_CHAINS_VALUE, CHAIN_NAME_RE } from "../constants"
import {
  hasExternalChainReference,
  isBuiltInChain,
  tableChainNames,
} from "../rules"
import type { TableName } from "../types"
import { ErrorList } from "./form-fields"
import { IconButton } from "./icon-button"

export function ChainNavigation({
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

export function ChainEmptyState({
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

export function PoliciesEditor({
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

export function ChainManager({
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

export function ChainFilterSelect({
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
