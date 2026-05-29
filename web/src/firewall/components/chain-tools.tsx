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
import type { FilterRule, NatRule, Policy, Ruleset } from "@/types/firewall"

import { ALL_CHAINS_VALUE, BUILT_IN_CHAINS, CHAIN_NAME_RE } from "../constants"
import {
  chainBindingStates,
  hasExternalChainReference,
  isBuiltInChain,
  tableChainNames,
  type ChainBindingState,
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
  const [selectedBindings, setSelectedBindings] = useState<string[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const builtInChains = BUILT_IN_CHAINS[table]
  const chains = useMemo(
    () => tableChainNames(ruleset, table, { includeDefaults: true }),
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

  function toggleSelectedBinding(sourceChain: string, checked: boolean) {
    setSelectedBindings((current) => {
      if (checked) {
        return current.includes(sourceChain)
          ? current
          : [...current, sourceChain]
      }

      return current.filter((chain) => chain !== sourceChain)
    })
  }

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

    const sourceChains = builtInChains.filter((sourceChain) =>
      selectedBindings.includes(sourceChain)
    )
    const policies = [
      ...ruleset.policies,
      {
        table,
        chain,
        policy: "-",
        order: nextOrder(
          ruleset.policies.filter((item) => item.table === table)
        ),
      },
    ]

    onChange({
      ...ruleset,
      policies,
      filterRules:
        table === "filter"
          ? appendFilterBindingRules(
              ruleset.filterRules,
              chain,
              sourceChains
            )
          : ruleset.filterRules,
      natRules:
        table === "nat"
          ? appendNatBindingRules(ruleset.natRules, chain, sourceChains)
          : ruleset.natRules,
    })
    setChainName("")
    setSelectedBindings([])
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

  function updateChainBinding(
    targetChain: string,
    binding: ChainBindingState,
    checked: boolean
  ) {
    if (checked && binding.managedRuleIds.length === 0) {
      onChange({
        ...ruleset,
        filterRules:
          table === "filter"
            ? [
                ...ruleset.filterRules,
                createFilterBindingRule(
                  binding.sourceChain,
                  targetChain,
                  nextOrder(ruleset.filterRules)
                ),
              ]
            : ruleset.filterRules,
        natRules:
          table === "nat"
            ? [
                ...ruleset.natRules,
                createNatBindingRule(
                  binding.sourceChain,
                  targetChain,
                  nextOrder(ruleset.natRules)
                ),
              ]
            : ruleset.natRules,
      })
      setErrors([])
      return
    }

    if (!checked && binding.managedRuleIds.length > 0) {
      onChange({
        ...ruleset,
        filterRules:
          table === "filter"
            ? ruleset.filterRules.filter(
                (rule) => !binding.managedRuleIds.includes(rule.id)
              )
            : ruleset.filterRules,
        natRules:
          table === "nat"
            ? ruleset.natRules.filter(
                (rule) => !binding.managedRuleIds.includes(rule.id)
              )
            : ruleset.natRules,
      })
      setErrors([])
    }
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
      <div className="grid gap-2">
        <Label>{t("chainBindingsTitle")}</Label>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
          {builtInChains.map((sourceChain) => (
            <label
              key={sourceChain}
              className="flex min-h-9 items-center gap-2 rounded-md border px-2 py-2 text-sm"
            >
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={selectedBindings.includes(sourceChain)}
                onChange={(event) =>
                  toggleSelectedBinding(sourceChain, event.target.checked)
                }
              />
              <span className="font-mono">{sourceChain}</span>
            </label>
          ))}
        </div>
      </div>
      <ErrorList errors={errors} />
      {customPolicies.length ? (
        <div className="grid gap-3">
          {customPolicies.map((policy) => {
            const referenced = hasExternalChainReference(
              ruleset,
              table,
              policy.chain
            )
            const bindings = chainBindingStates(ruleset, table, policy.chain)
            return (
              <div
                key={`${policy.table}-${policy.chain}`}
                className="grid gap-3 rounded-md border bg-background px-3 py-3"
              >
                <div className="flex items-center gap-2">
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
                <div className="grid gap-2">
                  <Label>{t("chainBindingsTitle")}</Label>
                  <div className="grid gap-2">
                    {bindings.map((binding) => {
                      const checked = binding.managedRuleIds.length > 0
                      const blocked =
                        !checked && (binding.conditional || binding.raw)

                      return (
                        <label
                          key={binding.sourceChain}
                          data-disabled={blocked ? true : undefined}
                          className="flex min-h-9 flex-wrap items-center gap-2 rounded-md border px-2 py-2 text-sm data-[disabled=true]:opacity-60"
                        >
                          <input
                            type="checkbox"
                            className="size-4 accent-primary disabled:cursor-not-allowed"
                            checked={checked}
                            disabled={blocked}
                            onChange={(event) =>
                              updateChainBinding(
                                policy.chain,
                                binding,
                                event.target.checked
                              )
                            }
                          />
                          <span className="font-mono">
                            {binding.sourceChain}
                          </span>
                          {binding.conditional ? (
                            <Badge variant="outline">
                              {t("conditionalChainReference")}
                            </Badge>
                          ) : null}
                          {binding.raw ? (
                            <Badge variant="outline">
                              {t("rawChainReference")}
                            </Badge>
                          ) : null}
                        </label>
                      )
                    })}
                  </div>
                </div>
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

function appendFilterBindingRules(
  rules: FilterRule[],
  targetChain: string,
  sourceChains: string[]
) {
  const order = nextOrder(rules)

  return [
    ...rules,
    ...sourceChains.map((sourceChain, index) =>
      createFilterBindingRule(sourceChain, targetChain, order + index * 10)
    ),
  ]
}

function appendNatBindingRules(
  rules: NatRule[],
  targetChain: string,
  sourceChains: string[]
) {
  const order = nextOrder(rules)

  return [
    ...rules,
    ...sourceChains.map((sourceChain, index) =>
      createNatBindingRule(sourceChain, targetChain, order + index * 10)
    ),
  ]
}

function createFilterBindingRule(
  sourceChain: string,
  targetChain: string,
  order: number
): FilterRule {
  return {
    id: newId("filter"),
    table: "filter",
    chain: sourceChain,
    target: targetChain,
    order,
    readOnly: false,
  }
}

function createNatBindingRule(
  sourceChain: string,
  targetChain: string,
  order: number
): NatRule {
  return {
    id: newId("nat"),
    type: "jump",
    table: "nat",
    chain: sourceChain,
    target: targetChain,
    order,
    readOnly: false,
  }
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
