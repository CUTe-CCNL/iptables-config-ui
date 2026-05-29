import { useEffect, useMemo, useState } from "react"
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
import {
  masqueradeSchema,
  portForwardSchema,
  zodMessages,
} from "@/lib/validation"
import type { NatRule, Ruleset } from "@/types/firewall"

import { preferredChain, tableChainNames } from "../rules"
import type { NatEditor, NatRuleFormState } from "../types"
import { ErrorList, SelectField, TextField } from "./form-fields"

export function NatRuleDialog({
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
  const chainOptions = useMemo(
    () => tableChainNames(ruleset, "nat", { includeDefaults: true }),
    [ruleset]
  )
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
    destinationCidr: existing?.destinationCidr ?? "",
    inInterface: existing?.inInterface ?? "",
    outInterface: existing?.outInterface ?? "",
    target: existing?.target ?? "RETURN",
    toSource: existing?.toSource ?? "",
    toPorts: existing?.toPorts ?? "",
    comment: existing?.comment ?? "",
  })
  const [errors, setErrors] = useState<string[]>([])
  const targetOptions = useMemo(
    () => ["RETURN", ...chainOptions.filter((chain) => chain !== form.chain)],
    [chainOptions, form.chain]
  )

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
        destinationCidr: existing?.destinationCidr,
        inInterface: compact(value.inInterface),
        outInterface: existing?.outInterface,
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
      destinationCidr: compact(form.destinationCidr),
      outInterface: compact(value.outInterface),
      comment: compact(value.comment),
      target: "MASQUERADE",
      toPorts: compact(form.toPorts),
      order: existing?.order ?? nextOrderValue,
      readOnly: existing?.readOnly ?? false,
      extra: existing?.extra,
    })
  }

  function saveGeneric() {
    if (!editor || !existing) return
    if (!chainOptions.includes(form.chain)) {
      setErrors([translateValidationMessage("Unknown chain")])
      return
    }
    if (ruleType === "snat" && !form.toSource.trim()) {
      setErrors([t("fieldToSource")])
      return
    }
    if (ruleType === "jump" && !targetOptions.includes(form.target)) {
      setErrors([translateValidationMessage("Unknown target")])
      return
    }

    onSave({
      ...existing,
      chain: form.chain,
      protocol: form.protocol,
      listenPort: compact(form.listenPort),
      sourceCidr: compact(form.sourceCidr),
      destinationCidr: compact(form.destinationCidr),
      inInterface: compact(form.inInterface),
      outInterface: compact(form.outInterface),
      target:
        ruleType === "snat"
          ? "SNAT"
          : ruleType === "redirect"
            ? "REDIRECT"
            : form.target,
      toSource: compact(form.toSource),
      toPorts: compact(form.toPorts),
      comment: compact(form.comment),
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
            onValueChange={(value) =>
              updateCreateType(value as NatRule["type"])
            }
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
              onChange={(value) => setForm({ ...form, destinationPort: value })}
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
        ) : ruleType === "masquerade" ? (
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
              label={t("fieldToPorts")}
              value={form.toPorts}
              onChange={(value) => setForm({ ...form, toPorts: value })}
              placeholder={t("optionalPlaceholder")}
            />
            <TextField
              label={t("fieldComment")}
              value={form.comment}
              onChange={(value) => setForm({ ...form, comment: value })}
            />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SelectField
              label={t("fieldChain")}
              value={form.chain}
              onValueChange={(value) => setForm({ ...form, chain: value })}
              options={chainOptions}
            />
            {ruleType === "jump" ? (
              <SelectField
                label={t("fieldTarget")}
                value={form.target}
                onValueChange={(value) => setForm({ ...form, target: value })}
                options={targetOptions}
              />
            ) : null}
            {ruleType === "redirect" ? (
              <SelectField
                label={t("fieldProtocol")}
                value={form.protocol}
                onValueChange={(value) =>
                  setForm({ ...form, protocol: value as "tcp" | "udp" })
                }
                options={["tcp", "udp"]}
              />
            ) : null}
            <TextField
              label={t("fieldSourceCidr")}
              value={form.sourceCidr}
              onChange={(value) => setForm({ ...form, sourceCidr: value })}
              placeholder={t("optionalPlaceholder")}
            />
            <TextField
              label={t("fieldDestinationCidr")}
              value={form.destinationCidr}
              onChange={(value) =>
                setForm({ ...form, destinationCidr: value })
              }
              placeholder={t("optionalPlaceholder")}
            />
            <TextField
              label={t("fieldInputInterface")}
              value={form.inInterface}
              onChange={(value) => setForm({ ...form, inInterface: value })}
              placeholder={t("optionalPlaceholder")}
            />
            <TextField
              label={t("fieldOutputInterface")}
              value={form.outInterface}
              onChange={(value) => setForm({ ...form, outInterface: value })}
              placeholder={t("optionalPlaceholder")}
            />
            {ruleType === "snat" ? (
              <TextField
                label={t("fieldToSource")}
                value={form.toSource}
                onChange={(value) => setForm({ ...form, toSource: value })}
                placeholder="203.0.113.10"
              />
            ) : null}
            {ruleType === "redirect" ? (
              <>
                <TextField
                  label={t("fieldListenPort")}
                  value={form.listenPort}
                  onChange={(value) =>
                    setForm({ ...form, listenPort: value })
                  }
                  inputMode="numeric"
                />
                <TextField
                  label={t("fieldToPorts")}
                  value={form.toPorts}
                  onChange={(value) => setForm({ ...form, toPorts: value })}
                  inputMode="numeric"
                />
              </>
            ) : null}
            <div className="sm:col-span-2 lg:col-span-3">
              <TextField
                label={t("fieldComment")}
                value={form.comment}
                onChange={(value) => setForm({ ...form, comment: value })}
              />
            </div>
          </div>
        )}
        <ErrorList errors={errors} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            onClick={
              ruleType === "port-forward" || ruleType === "masquerade"
                ? save
                : saveGeneric
            }
          >
            <Save className="size-4" />
            {t("saveRule")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
