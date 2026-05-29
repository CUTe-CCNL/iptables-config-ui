import { useState } from "react"
import { ChevronDown, ChevronRight, Terminal } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { useI18n } from "@/lib/i18n"
import type { CommandDiagnostic, Ruleset } from "@/types/firewall"

import { StatusBadge } from "../components/status-badge"

export function DiagnosticsPanel({ ruleset }: { ruleset: Ruleset }) {
  const { t } = useI18n()
  const commands = ruleset.diagnostics?.commands ?? []

  return (
    <section className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-normal">
            {t("diagnosticsTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("diagnosticsDescription")}
          </p>
        </div>
        <StatusBadge tone="muted">
          {t("diagnosticsCommandCount", { count: commands.length })}
        </StatusBadge>
      </div>

      {commands.length ? (
        <div className="grid gap-4">
          {commands.map((command, index) => (
            <CommandPanel
              key={`${command.name}-${index}-${command.args?.join("-") ?? ""}`}
              command={command}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          {t("noDiagnostics")}
        </div>
      )}
    </section>
  )
}

function CommandPanel({ command }: { command: CommandDiagnostic }) {
  const { t } = useI18n()
  const fullCommand = [command.name, ...(command.args ?? [])].join(" ")
  const ok = command.exitCode === 0
  const stderr = command.stderr || command.error || ""

  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <Terminal className="size-4 shrink-0 text-muted-foreground" />
          <code className="truncate font-mono text-sm">{fullCommand}</code>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={ok ? "secondary" : "destructive"}>
            exit {command.exitCode}
          </Badge>
          <Badge variant="outline">{command.durationMs}ms</Badge>
        </div>
      </div>
      <div className="grid gap-3 p-3">
        <CommandOutput title="stdout" value={command.stdout} empty={t("emptyOutput")} />
        <CollapsibleCommandOutput
          title="stderr / error"
          value={stderr}
          empty={t("emptyOutput")}
        />
      </div>
    </section>
  )
}

function CollapsibleCommandOutput({
  title,
  value,
  empty,
}: {
  title: string
  value?: string
  empty: string
}) {
  const [open, setOpen] = useState(false)
  const hasOutput = Boolean(value)

  return (
    <div className="grid min-w-0 gap-2 rounded-md border bg-muted/20 p-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 justify-start gap-2 px-2 font-mono text-xs text-muted-foreground"
        onClick={() => setOpen((current) => !current)}
      >
        {open ? (
          <ChevronDown className="size-4" />
        ) : (
          <ChevronRight className="size-4" />
        )}
        {title}
        {hasOutput ? <Badge variant="destructive">!</Badge> : null}
      </Button>
      {open ? <CommandOutput title="" value={value} empty={empty} /> : null}
    </div>
  )
}

function CommandOutput({
  title,
  value,
  empty,
}: {
  title: string
  value?: string
  empty: string
}) {
  return (
    <div className="grid min-w-0 gap-2">
      <div className="font-mono text-xs font-medium text-muted-foreground">
        {title}
      </div>
      <ScrollArea className="h-64 rounded-md border bg-zinc-950 p-3 text-zinc-50">
        <pre className="min-w-max font-mono text-xs leading-relaxed">
          {value || empty}
        </pre>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  )
}
