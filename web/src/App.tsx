import { Component, useEffect, useMemo, useState, type ErrorInfo, type ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit3,
  ListRestart,
  Loader2,
  Plus,
  Power,
  RefreshCw,
  RotateCcw,
  Save,
  Shield,
  Trash2,
  XCircle,
} from "lucide-react";
import { api, ApiError } from "./api";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { ConfirmDialog, Dialog } from "./components/ui/dialog";
import { DataTable } from "./components/ui/data-table";
import { Field, Input, Select, Textarea } from "./components/ui/forms";
import { compact, clone, isEqualJSON, newId, nextOrder, reorder } from "./lib/utils";
import { filterRuleSchema, masqueradeSchema, portForwardSchema, zodMessages } from "./lib/validation";
import type { FilterRule, NatRule, RawRule, Ruleset, SystemStatus } from "./types/firewall";

type Tab = "filter" | "nat" | "raw";
type Toast = { tone: "success" | "danger" | "warning" | "default"; title: string; detail?: string };
type FilterEditor = { mode: "create" | "edit"; rule?: FilterRule } | null;
type ConfirmAction = "apply" | "rollback" | "shutdown" | null;

const emptyRuleDraft: Ruleset = {
  snapshotId: "",
  policies: [],
  filterRules: [],
  natRules: [],
  rawRules: [],
};

const SESSION_TOKEN_KEY = "iptables-config-ui-session-token";

export function App() {
  return (
    <AppErrorBoundary>
      <FirewallApp />
    </AppErrorBoundary>
  );
}

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("iptables-config-ui render error", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="app-shell">
          <section className="alert alert-danger">
            <AlertTriangle size={18} />
            <div>
              <strong>UI render failed</strong>
              <span>{this.state.error.message}</span>
            </div>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

function FirewallApp() {
  const [system, setSystem] = useState<SystemStatus | null>(null);
  const [token, setToken] = useState("");
  const [rules, setRules] = useState<Ruleset | null>(null);
  const [draft, setDraft] = useState<Ruleset | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("filter");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterEditor, setFilterEditor] = useState<FilterEditor>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  useEffect(() => {
    void boot();
  }, []);

  const pending = useMemo(() => {
    if (!rules || !draft) return false;
    return !isEqualJSON(stripVolatile(rules), stripVolatile(draft));
  }, [rules, draft]);

  const pendingCount = useMemo(() => {
    if (!rules || !draft) return 0;
    let count = 0;
    if (!isEqualJSON(rules.policies, draft.policies)) count++;
    if (!isEqualJSON(rules.filterRules, draft.filterRules)) count += Math.abs(draft.filterRules.length - rules.filterRules.length) || 1;
    if (!isEqualJSON(rules.natRules, draft.natRules)) count += Math.abs(draft.natRules.length - rules.natRules.length) || 1;
    return count;
  }, [rules, draft]);

  async function boot() {
    setLoading(true);
    setError(null);
    try {
      const sessionToken = readSessionToken();
      setToken(sessionToken);
      const status = await api.system();
      setSystem(status);
      const response = await api.rules();
      setRules(response.ruleset);
      setDraft(clone(response.ruleset));
    } catch (err) {
      setError(formatError(err));
      setDraft(clone(emptyRuleDraft));
    } finally {
      setLoading(false);
    }
  }

  async function refreshRules() {
    if (pending && !window.confirm("Discard draft changes and reload live iptables rules?")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await api.rules();
      setRules(response.ruleset);
      setDraft(clone(response.ruleset));
      pushToast("success", "Rules refreshed", "Loaded the current live iptables snapshot.");
    } catch (err) {
      setError(formatError(err));
      pushToast("danger", "Refresh failed", formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function runConfirmAction() {
    if (!confirmAction || !draft || !rules) return;
    setBusy(true);
    setError(null);
    try {
      if (confirmAction === "apply") {
        const validation = await api.validate(token, draft);
        if (!validation.valid) {
          pushToast("warning", "Draft is invalid", validation.errors.join(" "));
          return;
        }
        const response = await api.apply(token, rules.snapshotId, draft);
        setRules(response.ruleset);
        setDraft(clone(response.ruleset));
        pushToast("success", "Rules applied", "Live iptables rules were updated.");
      }
      if (confirmAction === "rollback") {
        const response = await api.rollback(token);
        setRules(response.ruleset);
        setDraft(clone(response.ruleset));
        pushToast("success", "Rollback restored", "The previous in-memory snapshot is active again.");
      }
      if (confirmAction === "shutdown") {
        await api.shutdown(token);
        pushToast("success", "Server shutting down", "You can close this tab after the local service exits.");
      }
    } catch (err) {
      setError(formatError(err));
      pushToast("danger", actionTitle(confirmAction), formatError(err));
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  }

  function updateDraft(next: Ruleset) {
    setDraft(next);
  }

  function pushToast(tone: Toast["tone"], title: string, detail?: string) {
    setToast({ tone, title, detail });
    window.setTimeout(() => setToast(null), 4200);
  }

  const canMutate = Boolean(draft && rules && token && !loading);
  const commandsMissing = system?.commands.some((command) => !command.available) ?? false;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Shield size={20} />
          </div>
          <div>
            <h1>iptables Config UI</h1>
            <p>{system ? `${system.host} · ${system.user}` : "Loading host status"}</p>
          </div>
        </div>
        <div className="status-strip">
          <Badge tone={system?.mock ? "warning" : "success"}>{system?.mock ? "Mock mode" : "Live mode"}</Badge>
          <Badge tone={system?.root ? "success" : "warning"}>{system?.root ? "root" : "non-root"}</Badge>
          <Badge tone={commandsMissing ? "danger" : "success"}>{commandsMissing ? "commands missing" : "commands ready"}</Badge>
          <Badge tone={pending ? "warning" : "muted"}>{pendingCount} pending</Badge>
        </div>
        <div className="topbar-actions">
          <Button variant="secondary" onClick={refreshRules} disabled={busy || loading}>
            <RefreshCw size={16} />
            Refresh
          </Button>
          <Button variant="success" onClick={() => setConfirmAction("apply")} disabled={!canMutate || !pending || busy}>
            <Save size={16} />
            Apply
          </Button>
          <Button variant="outline" onClick={() => setConfirmAction("rollback")} disabled={!canMutate || busy}>
            <RotateCcw size={16} />
            Rollback
          </Button>
          <Button variant="danger" onClick={() => setConfirmAction("shutdown")} disabled={!token || busy}>
            <Power size={16} />
            Shutdown
          </Button>
        </div>
      </header>

      {toast ? <ToastMessage toast={toast} onClose={() => setToast(null)} /> : null}

      <section className="status-grid">
        <StatusCard label="Listen address" value={system?.addr ?? "127.0.0.1:8921"} tone="default" />
        <StatusCard label="Snapshot" value={rules?.snapshotId ? rules.snapshotId.slice(0, 12) : "unavailable"} tone={rules ? "success" : "warning"} />
        <StatusCard
          label="Filter rules"
          value={String(draft?.filterRules.length ?? 0)}
          tone={(draft?.filterRules.length ?? 0) > 0 ? "success" : "default"}
        />
        <StatusCard label="NAT rules" value={String(draft?.natRules.length ?? 0)} tone={(draft?.natRules.length ?? 0) > 0 ? "warning" : "default"} />
      </section>

      {error ? (
        <section className="alert alert-danger">
          <AlertTriangle size={18} />
          <div>
            <strong>{error}</strong>
            <span>Use --mock for local development when iptables is not installed.</span>
          </div>
        </section>
      ) : null}

      {!token ? (
        <section className="alert alert-warning">
          <AlertTriangle size={18} />
          <div>
            <strong>Session token is missing</strong>
            <span>Open the URL printed by the server, including the ?token= value, to enable Apply, Rollback, and Shutdown.</span>
          </div>
        </section>
      ) : null}

      <section className="workspace">
        <nav className="tabs" aria-label="Firewall sections">
          <button className={activeTab === "filter" ? "tab active" : "tab"} onClick={() => setActiveTab("filter")}>
            Filter Rules
          </button>
          <button className={activeTab === "nat" ? "tab active" : "tab"} onClick={() => setActiveTab("nat")}>
            NAT / Port Forward
          </button>
          <button className={activeTab === "raw" ? "tab active" : "tab"} onClick={() => setActiveTab("raw")}>
            Raw / Read-only
          </button>
        </nav>

        {loading ? (
          <div className="loading-panel">
            <Loader2 className="spin" size={22} />
            Loading iptables snapshot
          </div>
        ) : null}

        {!loading && draft && activeTab === "filter" ? (
          <FilterRulesPanel
            ruleset={draft}
            onChange={updateDraft}
            onCreate={() => setFilterEditor({ mode: "create" })}
            onEdit={(rule) => setFilterEditor({ mode: "edit", rule })}
          />
        ) : null}

        {!loading && draft && activeTab === "nat" ? <NatPanel ruleset={draft} onChange={updateDraft} pushToast={pushToast} /> : null}

        {!loading && draft && activeTab === "raw" ? <RawPanel ruleset={draft} /> : null}
      </section>

      <FilterRuleDialog
        key={filterEditor?.rule?.id ?? filterEditor?.mode ?? "closed"}
        editor={filterEditor}
        nextOrderValue={nextOrder(draft?.filterRules ?? [])}
        onClose={() => setFilterEditor(null)}
        onSave={(rule) => {
          if (!draft) return;
          const filterRules =
            filterEditor?.mode === "edit"
              ? draft.filterRules.map((item) => (item.id === rule.id ? rule : item))
              : [...draft.filterRules, rule];
          updateDraft({ ...draft, filterRules });
          setFilterEditor(null);
          pushToast("success", filterEditor?.mode === "edit" ? "Rule updated" : "Rule added");
        }}
      />

      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmTitle(confirmAction)}
        description={confirmDescription(confirmAction)}
        confirmLabel={confirmLabel(confirmAction)}
        tone={confirmAction === "shutdown" ? "danger" : confirmAction === "apply" ? "success" : "default"}
        busy={busy}
        onCancel={() => setConfirmAction(null)}
        onConfirm={runConfirmAction}
      />
    </main>
  );
}

function FilterRulesPanel({
  ruleset,
  onChange,
  onCreate,
  onEdit,
}: {
  ruleset: Ruleset;
  onChange: (ruleset: Ruleset) => void;
  onCreate: () => void;
  onEdit: (rule: FilterRule) => void;
}) {
  const rows = useMemo(() => [...ruleset.filterRules].sort((a, b) => a.order - b.order), [ruleset.filterRules]);

  function remove(rule: FilterRule) {
    onChange({ ...ruleset, filterRules: ruleset.filterRules.filter((item) => item.id !== rule.id) });
  }

  function move(rule: FilterRule, direction: -1 | 1) {
    const index = rows.findIndex((item) => item.id === rule.id);
    onChange({ ...ruleset, filterRules: reorder(rows, index, direction) });
  }

  const columns = useMemo<ColumnDef<FilterRule>[]>(
    () => [
      { header: "Chain", accessorKey: "chain", size: 88 },
      {
        header: "Target",
        cell: ({ row }) => <Badge tone={targetTone(row.original.target)}>{row.original.target}</Badge>,
        size: 96,
      },
      {
        header: "Match",
        cell: ({ row }) => <RuleMatch rule={row.original} />,
      },
      {
        header: "Comment",
        cell: ({ row }) => <span className="muted mono">{row.original.comment || "—"}</span>,
      },
      {
        header: "Actions",
        cell: ({ row }) => (
          <div className="row-actions">
            <Button variant="ghost" size="icon" onClick={() => move(row.original, -1)} aria-label="Move rule up">
              <ChevronUp size={16} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => move(row.original, 1)} aria-label="Move rule down">
              <ChevronDown size={16} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onEdit(row.original)} aria-label="Edit rule">
              <Edit3 size={16} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => remove(row.original)} aria-label="Delete rule">
              <Trash2 size={16} />
            </Button>
          </div>
        ),
        size: 180,
      },
    ],
    [rows, ruleset],
  );

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Filter Rules</h2>
          <p>Editable IPv4 INPUT, OUTPUT, and FORWARD rules. Unsupported lines stay read-only in Raw.</p>
        </div>
        <Button onClick={onCreate}>
          <Plus size={16} />
          Add rule
        </Button>
      </div>
      <DataTable data={rows} columns={columns} empty="No editable filter rules in this snapshot." />
    </section>
  );
}

function NatPanel({
  ruleset,
  onChange,
  pushToast,
}: {
  ruleset: Ruleset;
  onChange: (ruleset: Ruleset) => void;
  pushToast: (tone: Toast["tone"], title: string, detail?: string) => void;
}) {
  const rows = useMemo(() => [...ruleset.natRules].sort((a, b) => a.order - b.order), [ruleset.natRules]);

  function remove(rule: NatRule) {
    onChange({ ...ruleset, natRules: ruleset.natRules.filter((item) => item.id !== rule.id) });
  }

  function move(rule: NatRule, direction: -1 | 1) {
    const index = rows.findIndex((item) => item.id === rule.id);
    onChange({ ...ruleset, natRules: reorder(rows, index, direction) });
  }

  const columns = useMemo<ColumnDef<NatRule>[]>(
    () => [
      {
        header: "Type",
        cell: ({ row }) => <Badge tone={row.original.type === "port-forward" ? "warning" : "success"}>{row.original.type}</Badge>,
        size: 120,
      },
      {
        header: "Match",
        cell: ({ row }) =>
          row.original.type === "port-forward" ? (
            <span className="mono">
              {row.original.protocol}/{row.original.listenPort} → {row.original.destinationIp}:{row.original.destinationPort}
            </span>
          ) : (
            <span className="mono">source {row.original.sourceCidr || "any"} → {row.original.outInterface || "any iface"}</span>
          ),
      },
      {
        header: "Scope",
        cell: ({ row }) => (
          <span className="muted mono">
            {row.original.inInterface ? `in:${row.original.inInterface} ` : ""}
            {row.original.outInterface ? `out:${row.original.outInterface} ` : ""}
            {row.original.sourceCidr ? `src:${row.original.sourceCidr}` : ""}
          </span>
        ),
      },
      {
        header: "Comment",
        cell: ({ row }) => <span className="muted mono">{row.original.comment || "—"}</span>,
      },
      {
        header: "Actions",
        cell: ({ row }) => (
          <div className="row-actions">
            <Button variant="ghost" size="icon" onClick={() => move(row.original, -1)} aria-label="Move rule up">
              <ChevronUp size={16} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => move(row.original, 1)} aria-label="Move rule down">
              <ChevronDown size={16} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => remove(row.original)} aria-label="Delete NAT rule">
              <Trash2 size={16} />
            </Button>
          </div>
        ),
        size: 144,
      },
    ],
    [rows, ruleset],
  );

  function addRule(rule: NatRule) {
    onChange({ ...ruleset, natRules: [...ruleset.natRules, rule] });
  }

  return (
    <section className="panel nat-layout">
      <div className="panel-head">
        <div>
          <h2>NAT / Port Forward</h2>
          <p>V1 supports PREROUTING DNAT and POSTROUTING MASQUERADE. Other NAT lines stay read-only.</p>
        </div>
      </div>
      <div className="nat-grid">
        <PortForwardForm order={nextOrder(ruleset.natRules)} onAdd={addRule} pushToast={pushToast} />
        <MasqueradeForm order={nextOrder(ruleset.natRules)} onAdd={addRule} pushToast={pushToast} />
      </div>
      <DataTable data={rows} columns={columns} empty="No editable NAT rules in this snapshot." />
    </section>
  );
}

function RawPanel({ ruleset }: { ruleset: Ruleset }) {
  const columns = useMemo<ColumnDef<RawRule>[]>(
    () => [
      { header: "Table", accessorKey: "table", size: 90 },
      { header: "Chain", accessorKey: "chain", size: 120 },
      {
        header: "Line",
        cell: ({ row }) => <code className="raw-line">{row.original.line}</code>,
      },
      {
        header: "Reason",
        cell: ({ row }) => <span className="muted">{row.original.reason}</span>,
      },
    ],
    [],
  );

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Raw / Read-only</h2>
          <p>These rules are preserved during apply, but V1 does not expose structured editing for them.</p>
        </div>
        <Badge tone="muted">{ruleset.rawRules.length} read-only</Badge>
      </div>
      <DataTable data={[...ruleset.rawRules].sort((a, b) => a.table.localeCompare(b.table) || a.order - b.order)} columns={columns} empty="No unsupported rules detected." />
      <details className="raw-details">
        <summary>iptables-save snapshot</summary>
        <pre>{ruleset.raw || "No raw snapshot available."}</pre>
      </details>
    </section>
  );
}

function FilterRuleDialog({
  editor,
  nextOrderValue,
  onClose,
  onSave,
}: {
  editor: FilterEditor;
  nextOrderValue: number;
  onClose: () => void;
  onSave: (rule: FilterRule) => void;
}) {
  const existing = editor?.rule;
  const [form, setForm] = useState({
    chain: existing?.chain ?? "INPUT",
    target: existing?.target ?? "ACCEPT",
    protocol: existing?.protocol ?? "tcp",
    source: existing?.source ?? "",
    destination: existing?.destination ?? "",
    inInterface: existing?.inInterface ?? "",
    outInterface: existing?.outInterface ?? "",
    sourcePort: existing?.sourcePort ?? "",
    destinationPort: existing?.destinationPort ?? "",
    comment: existing?.comment ?? "",
  });
  const [errors, setErrors] = useState<string[]>([]);

  function save() {
    const parsed = filterRuleSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(zodMessages(parsed.error));
      return;
    }
    const value = parsed.data;
    onSave({
      id: existing?.id ?? newId("filter"),
      table: "filter",
      chain: value.chain,
      target: value.target,
      protocol: value.protocol,
      source: compact(value.source),
      destination: compact(value.destination),
      inInterface: compact(value.inInterface),
      outInterface: compact(value.outInterface),
      sourcePort: compact(value.sourcePort),
      destinationPort: compact(value.destinationPort),
      comment: compact(value.comment),
      order: existing?.order ?? nextOrderValue,
      readOnly: false,
    });
  }

  return (
    <Dialog
      open={editor !== null}
      title={editor?.mode === "edit" ? "Edit filter rule" : "Add filter rule"}
      description="Create a structured IPv4 filter rule for INPUT, OUTPUT, or FORWARD."
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>
            <Save size={16} />
            Save rule
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Chain">
          <Select value={form.chain} onChange={(event) => setForm({ ...form, chain: event.target.value as FilterRule["chain"] })}>
            <option value="INPUT">INPUT</option>
            <option value="OUTPUT">OUTPUT</option>
            <option value="FORWARD">FORWARD</option>
          </Select>
        </Field>
        <Field label="Target">
          <Select value={form.target} onChange={(event) => setForm({ ...form, target: event.target.value as FilterRule["target"] })}>
            <option value="ACCEPT">ACCEPT</option>
            <option value="DROP">DROP</option>
            <option value="REJECT">REJECT</option>
          </Select>
        </Field>
        <Field label="Protocol">
          <Select value={form.protocol} onChange={(event) => setForm({ ...form, protocol: event.target.value as "" | "tcp" | "udp" | "icmp" })}>
            <option value="">any</option>
            <option value="tcp">tcp</option>
            <option value="udp">udp</option>
            <option value="icmp">icmp</option>
          </Select>
        </Field>
        <Field label="Source">
          <Input value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} placeholder="10.0.0.0/24" />
        </Field>
        <Field label="Destination">
          <Input value={form.destination} onChange={(event) => setForm({ ...form, destination: event.target.value })} placeholder="192.168.1.10" />
        </Field>
        <Field label="Input interface">
          <Input value={form.inInterface} onChange={(event) => setForm({ ...form, inInterface: event.target.value })} placeholder="eth0" />
        </Field>
        <Field label="Output interface">
          <Input value={form.outInterface} onChange={(event) => setForm({ ...form, outInterface: event.target.value })} placeholder="eth1" />
        </Field>
        <Field label="Source port">
          <Input value={form.sourcePort} onChange={(event) => setForm({ ...form, sourcePort: event.target.value })} inputMode="numeric" />
        </Field>
        <Field label="Destination port">
          <Input value={form.destinationPort} onChange={(event) => setForm({ ...form, destinationPort: event.target.value })} inputMode="numeric" />
        </Field>
        <Field label="Comment">
          <Input value={form.comment} onChange={(event) => setForm({ ...form, comment: event.target.value })} placeholder="SSH admin" />
        </Field>
      </div>
      {errors.length ? <ErrorList errors={errors} /> : null}
    </Dialog>
  );
}

function PortForwardForm({
  order,
  onAdd,
  pushToast,
}: {
  order: number;
  onAdd: (rule: NatRule) => void;
  pushToast: (tone: Toast["tone"], title: string, detail?: string) => void;
}) {
  const [form, setForm] = useState({
    protocol: "tcp",
    listenPort: "",
    destinationIp: "",
    destinationPort: "",
    sourceCidr: "",
    inInterface: "",
    comment: "",
  });
  const [errors, setErrors] = useState<string[]>([]);

  function add() {
    const parsed = portForwardSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(zodMessages(parsed.error));
      return;
    }
    const value = parsed.data;
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
    });
    setForm({ protocol: "tcp", listenPort: "", destinationIp: "", destinationPort: "", sourceCidr: "", inInterface: "", comment: "" });
    setErrors([]);
    pushToast("success", "Port forward added");
  }

  return (
    <div className="inline-card">
      <h3>Port forward</h3>
      <div className="form-grid compact">
        <Field label="Protocol">
          <Select value={form.protocol} onChange={(event) => setForm({ ...form, protocol: event.target.value as "tcp" | "udp" })}>
            <option value="tcp">tcp</option>
            <option value="udp">udp</option>
          </Select>
        </Field>
        <Field label="Listen port">
          <Input value={form.listenPort} onChange={(event) => setForm({ ...form, listenPort: event.target.value })} inputMode="numeric" />
        </Field>
        <Field label="Destination IP">
          <Input value={form.destinationIp} onChange={(event) => setForm({ ...form, destinationIp: event.target.value })} placeholder="10.0.0.20" />
        </Field>
        <Field label="Destination port">
          <Input value={form.destinationPort} onChange={(event) => setForm({ ...form, destinationPort: event.target.value })} inputMode="numeric" />
        </Field>
        <Field label="Source CIDR">
          <Input value={form.sourceCidr} onChange={(event) => setForm({ ...form, sourceCidr: event.target.value })} placeholder="optional" />
        </Field>
        <Field label="Input interface">
          <Input value={form.inInterface} onChange={(event) => setForm({ ...form, inInterface: event.target.value })} placeholder="optional" />
        </Field>
      </div>
      <Field label="Comment">
        <Input value={form.comment} onChange={(event) => setForm({ ...form, comment: event.target.value })} />
      </Field>
      {errors.length ? <ErrorList errors={errors} /> : null}
      <Button onClick={add}>
        <Plus size={16} />
        Add forward
      </Button>
    </div>
  );
}

function MasqueradeForm({
  order,
  onAdd,
  pushToast,
}: {
  order: number;
  onAdd: (rule: NatRule) => void;
  pushToast: (tone: Toast["tone"], title: string, detail?: string) => void;
}) {
  const [form, setForm] = useState({ sourceCidr: "", outInterface: "", comment: "" });
  const [errors, setErrors] = useState<string[]>([]);

  function add() {
    const parsed = masqueradeSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(zodMessages(parsed.error));
      return;
    }
    const value = parsed.data;
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
    });
    setForm({ sourceCidr: "", outInterface: "", comment: "" });
    setErrors([]);
    pushToast("success", "MASQUERADE rule added");
  }

  return (
    <div className="inline-card">
      <h3>MASQUERADE</h3>
      <div className="form-grid compact">
        <Field label="Source CIDR">
          <Input value={form.sourceCidr} onChange={(event) => setForm({ ...form, sourceCidr: event.target.value })} placeholder="10.0.0.0/24" />
        </Field>
        <Field label="Output interface">
          <Input value={form.outInterface} onChange={(event) => setForm({ ...form, outInterface: event.target.value })} placeholder="eth0" />
        </Field>
      </div>
      <Field label="Comment">
        <Input value={form.comment} onChange={(event) => setForm({ ...form, comment: event.target.value })} />
      </Field>
      {errors.length ? <ErrorList errors={errors} /> : null}
      <Button variant="secondary" onClick={add}>
        <Plus size={16} />
        Add masquerade
      </Button>
    </div>
  );
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
  ].filter(Boolean);
  return <span className="mono">{parts.join(" ")}</span>;
}

function StatusCard({ label, value, tone }: { label: string; value: string; tone: Toast["tone"] }) {
  return (
    <div className={`status-card status-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ToastMessage({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const Icon = toast.tone === "success" ? CheckCircle2 : toast.tone === "danger" ? XCircle : AlertTriangle;
  return (
    <div className={`toast toast-${toast.tone}`} role="status">
      <Icon size={18} />
      <div>
        <strong>{toast.title}</strong>
        {toast.detail ? <span>{toast.detail}</span> : null}
      </div>
      <Button variant="ghost" size="icon" onClick={onClose} aria-label="Dismiss notification">
        <XCircle size={16} />
      </Button>
    </div>
  );
}

function ErrorList({ errors }: { errors: string[] }) {
  return (
    <ul className="error-list">
      {errors.map((error) => (
        <li key={error}>{error}</li>
      ))}
    </ul>
  );
}

function stripVolatile(rs: Ruleset) {
  const copy = clone(rs);
  delete copy.raw;
  delete copy.warnings;
  return copy;
}

function readSessionToken() {
  const params = new URLSearchParams(window.location.search);
  const fromURL = params.get("token")?.trim();
  if (fromURL) {
    window.localStorage.setItem(SESSION_TOKEN_KEY, fromURL);
    window.history.replaceState(null, "", window.location.pathname + window.location.hash);
    return fromURL;
  }
  return window.localStorage.getItem(SESSION_TOKEN_KEY) ?? "";
}

function formatError(err: unknown) {
  if (err instanceof ApiError) {
    return `${err.status}: ${err.message}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Unknown error";
}

function targetTone(target: string) {
  if (target === "ACCEPT") return "success";
  if (target === "DROP") return "danger";
  return "warning";
}

function confirmTitle(action: ConfirmAction) {
  if (action === "apply") return "Apply firewall draft";
  if (action === "rollback") return "Rollback last apply";
  if (action === "shutdown") return "Shutdown local server";
  return "Confirm action";
}

function confirmDescription(action: ConfirmAction) {
  if (action === "apply") return "This will replace the live IPv4 iptables rules with the current draft. A rollback snapshot is kept while this process stays alive.";
  if (action === "rollback") return "This restores the in-memory snapshot captured before the last successful apply.";
  if (action === "shutdown") return "This stops the local Go process that is serving the UI and API.";
  return "";
}

function confirmLabel(action: ConfirmAction) {
  if (action === "apply") return "Apply rules";
  if (action === "rollback") return "Rollback";
  if (action === "shutdown") return "Shutdown";
  return "Confirm";
}

function actionTitle(action: ConfirmAction) {
  if (action === "apply") return "Apply failed";
  if (action === "rollback") return "Rollback failed";
  if (action === "shutdown") return "Shutdown failed";
  return "Action failed";
}
