import { z } from "zod"

const port = z
  .string()
  .trim()
  .regex(/^\d+$/, "Port must be a number")
  .refine((value) => {
    const n = Number(value)
    return n >= 1 && n <= 65535
  }, "Port must be between 1 and 65535")

const optionalPort = z
  .string()
  .trim()
  .optional()
  .transform((value) => value ?? "")
  .refine(
    (value) => value === "" || /^\d+$/.test(value),
    "Port must be a number"
  )
  .refine((value) => {
    if (value === "") return true
    const n = Number(value)
    return n >= 1 && n <= 65535
  }, "Port must be between 1 and 65535")

const cidrOrIp = z
  .string()
  .trim()
  .optional()
  .transform((value) => value ?? "")
  .refine(
    (value) => value === "" || /^[0-9./]+$/.test(value),
    "Use an IPv4 address or CIDR"
  )

const iface = z
  .string()
  .trim()
  .optional()
  .transform((value) => value ?? "")
  .refine(
    (value) => value === "" || /^[A-Za-z0-9_.:+-]{1,32}$/.test(value),
    "Invalid interface name"
  )

const chainName = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_.:+-]{1,32}$/, "Invalid chain name")

function knownValue(options: string[]) {
  return (value: string) => options.includes(value)
}

export function filterRuleSchema({
  chains,
  targets,
}: {
  chains: string[]
  targets: string[]
}) {
  return z
    .object({
      chain: chainName.refine(knownValue(chains), "Unknown chain"),
      target: chainName.refine(knownValue(targets), "Unknown target"),
      protocol: z.enum(["any", "tcp", "udp", "icmp"]),
      source: cidrOrIp,
      destination: cidrOrIp,
      inInterface: iface,
      outInterface: iface,
      sourcePort: optionalPort,
      destinationPort: optionalPort,
      comment: z
        .string()
        .trim()
        .max(80, "Comment must be 80 characters or fewer")
        .optional()
        .default(""),
    })
    .superRefine((value, ctx) => {
      if (
        (value.sourcePort || value.destinationPort) &&
        value.protocol !== "tcp" &&
        value.protocol !== "udp"
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["protocol"],
          message: "Ports require tcp or udp",
        })
      }
    })
}

export function portForwardSchema(chains: string[]) {
  return z.object({
    chain: chainName.refine(knownValue(chains), "Unknown chain"),
    protocol: z.enum(["tcp", "udp"]),
    listenPort: port,
    destinationIp: z
      .string()
      .trim()
      .regex(/^\d{1,3}(\.\d{1,3}){3}$/, "Use an IPv4 address"),
    destinationPort: port,
    sourceCidr: cidrOrIp,
    inInterface: iface,
    comment: z
      .string()
      .trim()
      .max(80, "Comment must be 80 characters or fewer")
      .optional()
      .default(""),
  })
}

export function masqueradeSchema(chains: string[]) {
  return z.object({
    chain: chainName.refine(knownValue(chains), "Unknown chain"),
    sourceCidr: cidrOrIp,
    outInterface: iface,
    comment: z
      .string()
      .trim()
      .max(80, "Comment must be 80 characters or fewer")
      .optional()
      .default(""),
  })
}

export function zodMessages(
  error: z.ZodError,
  translateMessage: (message: string) => string = (message) => message
) {
  return error.issues.map((issue) => translateMessage(issue.message))
}
