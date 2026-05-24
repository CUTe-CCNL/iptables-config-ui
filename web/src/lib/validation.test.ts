import { describe, expect, it } from "vitest";
import { normalizeRuleset } from "../api";
import { filterRuleSchema, portForwardSchema } from "./validation";

describe("iptables form validation", () => {
  it("rejects ports without tcp or udp", () => {
    const result = filterRuleSchema.safeParse({
      chain: "INPUT",
      target: "ACCEPT",
      protocol: "icmp",
      source: "",
      destination: "",
      inInterface: "",
      outInterface: "",
      sourcePort: "",
      destinationPort: "443",
      comment: "",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a valid port forward", () => {
    const result = portForwardSchema.safeParse({
      protocol: "tcp",
      listenPort: "8443",
      destinationIp: "10.0.0.20",
      destinationPort: "443",
      sourceCidr: "10.0.0.0/24",
      inInterface: "eth0",
      comment: "HTTPS forward",
    });

    expect(result.success).toBe(true);
  });
});

describe("api normalization", () => {
  it("converts null rule arrays to empty arrays", () => {
    const normalized = normalizeRuleset({
      snapshotId: "abc",
      policies: null as never,
      filterRules: null as never,
      natRules: null as never,
      rawRules: null as never,
      warnings: null as never,
    });

    expect(normalized.policies).toEqual([]);
    expect(normalized.filterRules).toEqual([]);
    expect(normalized.natRules).toEqual([]);
    expect(normalized.rawRules).toEqual([]);
    expect(normalized.warnings).toEqual([]);
  });
});
