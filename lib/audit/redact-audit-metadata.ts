const SENSITIVE_KEY =
  /(password|passwd|token|secret|authorization|cookie|api[_-]?key|credential)/i;

export function redactAuditMetadata(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[MAX_DEPTH]";

  if (Array.isArray(value)) {
    return value.map((item) => redactAuditMetadata(item, depth + 1));
  }

  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      output[key] = SENSITIVE_KEY.test(key)
        ? "[REDACTED]"
        : redactAuditMetadata(item, depth + 1);
    }
    return output;
  }

  return value;
}
