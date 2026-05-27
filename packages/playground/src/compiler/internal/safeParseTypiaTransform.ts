/** Shape of the typia transform plugin's stdout JSON payload. */
export interface ITypiaTransformOutput {
  diagnostics?: unknown;
  typescript: Record<string, string>;
}

/**
 * Parse the typia transform plugin's stdout into the expected shape.
 * Returns null on any parse / shape mismatch — the caller treats null as
 * "transform produced no usable output".
 */
export function safeParseTypiaTransform(
  text: string,
): ITypiaTransformOutput | null {
  try {
    const parsed = JSON.parse(text) as ITypiaTransformOutput;
    if (parsed && typeof parsed === "object" && parsed.typescript) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
