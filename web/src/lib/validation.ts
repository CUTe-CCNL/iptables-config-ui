import { z } from "zod";

const port = z
  .string()
  .trim()
  .regex(/^\d+$/, "Port must be a number")
  .refine((value) => {
    const n = Number(value);
    return n >= 1 && n <= 65535;
  }, "Port must be between 1 and 65535");

const optionalPort = z
  .string()
  .trim()
  .optional()
  .transform((value) => value ?? "")
  .refine((value) => value === "" || /^\d+$/.test(value), "Port must be a number")
  .refine((value) => {
    if (value === "") return true;
    const n = Number(value);
    return n >= 1 && n <= 65535;
  }, "Port must be between 1 and 65535");

const cidrOrIp = z
  .string()
  .trim()
  .optional()
  .transform((value) => value ?? "")
  .refine((value) => value === "" || /^[0-9./]+$/.test(value), "Use an IPv4 address or CIDR");

const iface = z
  .string()
  .trim()
  .optional()
  .transform((value) => value ?? "")
  .refine((value) => value === "" || /^[A-Za-z0-9_.:+-]{1,32}$/.test(value), "Invalid interface name");

export const filterRuleSchema = z
  .object({
    chain: z.enum(["INPUT", "OUTPUT", "FORWARD"]),
    target: z.enum(["ACCEPT", "DROP", "REJECT"]),
    protocol: z.enum(["", "tcp", "udp", "icmp"]),
    source: cidrOrIp,
    destination: cidrOrIp,
    inInterface: iface,
    outInterface: iface,
    sourcePort: optionalPort,
    destinationPort: optionalPort,
    comment: z.string().trim().max(80, "Comment must be 80 characters or fewer").optional().default(""),
  })
  .superRefine((value, ctx) => {
    if ((value.sourcePort || value.destinationPort) && value.protocol !== "tcp" && value.protocol !== "udp") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["protocol"],
        message: "Ports require tcp or udp",
      });
    }
  });

export const portForwardSchema = z.object({
  protocol: z.enum(["tcp", "udp"]),
  listenPort: port,
  destinationIp: z.string().trim().regex(/^\d{1,3}(\.\d{1,3}){3}$/, "Use an IPv4 address"),
  destinationPort: port,
  sourceCidr: cidrOrIp,
  inInterface: iface,
  comment: z.string().trim().max(80, "Comment must be 80 characters or fewer").optional().default(""),
});

export const masqueradeSchema = z.object({
  sourceCidr: cidrOrIp,
  outInterface: iface,
  comment: z.string().trim().max(80, "Comment must be 80 characters or fewer").optional().default(""),
});

export function zodMessages(error: z.ZodError) {
  return error.issues.map((issue) => issue.message);
}

