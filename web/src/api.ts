import type {
  FilterRule,
  NatRule,
  Policy,
  RawRule,
  TableInfo,
  RulesResponse,
  Ruleset,
  SystemStatus,
  ValidationResult,
} from "@/types/firewall"

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  })

  const text = await response.text()
  const payload = text ? (JSON.parse(text) as unknown) : {}

  if (!response.ok) {
    throw new ApiError(
      response.status,
      errorMessage(payload, response.statusText)
    )
  }

  return payload as T
}

export const api = {
  system: async () =>
    normalizeSystemStatus(await request<SystemStatus>("/api/system")),
  rules: async (token: string) =>
    normalizeRulesResponse(
      await request<RulesResponse>("/api/rules", {
        headers: { "X-Session-Token": token },
      })
    ),
  validate: async (token: string, ruleset: Ruleset) =>
    normalizeValidationResult(
      await request<ValidationResult>("/api/validate", {
        method: "POST",
        headers: { "X-Session-Token": token },
        body: JSON.stringify({ ruleset }),
      })
    ),
  apply: async (token: string, snapshotId: string, ruleset: Ruleset) =>
    normalizeRulesResponse(
      await request<RulesResponse>("/api/apply", {
        method: "POST",
        headers: { "X-Session-Token": token },
        body: JSON.stringify({ snapshotId, ruleset }),
      })
    ),
  rollback: async (token: string) =>
    normalizeRulesResponse(
      await request<RulesResponse>("/api/rollback", {
        method: "POST",
        headers: { "X-Session-Token": token },
        body: JSON.stringify({}),
      })
    ),
  shutdown: (token: string) =>
    request<{ status: string }>("/api/shutdown", {
      method: "POST",
      headers: { "X-Session-Token": token },
      body: JSON.stringify({}),
    }),
}

export function normalizeRulesResponse(response: RulesResponse): RulesResponse {
  return { ruleset: normalizeRuleset(response.ruleset) }
}

export function normalizeRuleset(ruleset: Ruleset): Ruleset {
  return {
    ...ruleset,
    tables: arrayOrEmpty<TableInfo>(ruleset.tables),
    policies: arrayOrEmpty<Policy>(ruleset.policies),
    filterRules: arrayOrEmpty<FilterRule>(ruleset.filterRules),
    natRules: arrayOrEmpty<NatRule>(ruleset.natRules),
    rawRules: arrayOrEmpty<RawRule>(ruleset.rawRules),
    warnings: arrayOrEmpty<string>(ruleset.warnings),
    diagnostics: {
      ...ruleset.diagnostics,
      commands: arrayOrEmpty(ruleset.diagnostics?.commands),
    },
  }
}

function normalizeSystemStatus(status: SystemStatus): SystemStatus {
  return {
    ...status,
    commands: arrayOrEmpty(status.commands),
    capabilities: arrayOrEmpty(status.capabilities),
  }
}

function normalizeValidationResult(result: ValidationResult): ValidationResult {
  return {
    ...result,
    errors: arrayOrEmpty(result.errors),
  }
}

function arrayOrEmpty<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : []
}

function errorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const value = (payload as { error?: unknown }).error
    if (typeof value === "string" && value.trim()) {
      return value
    }
  }

  return fallback
}
