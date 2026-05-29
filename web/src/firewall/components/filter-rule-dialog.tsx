import { useMemo, useState } from "react"
import { Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useI18n } from "@/lib/i18n"
import { compact, newId } from "@/lib/utils"
import { filterRuleSchema, zodMessages } from "@/lib/validation"
import type { FilterRule, Ruleset } from "@/types/firewall"

import { FILTER_TARGETS } from "../constants"
import { preferredChain, tableChainNames, uniqueStrings } from "../rules"
import type {
  FilterEditor,
  FilterProtocolOption,
  FilterRuleFormState,
} from "../types"
import { ErrorList, SelectField, TextField } from "./form-fields"

export function FilterRuleDialog({
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
