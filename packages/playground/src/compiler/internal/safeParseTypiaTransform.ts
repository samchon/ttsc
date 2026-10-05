/**
 * Typia transform stdout envelope; typescript maps virtual paths to source
 * text.
 *
 * @evidence contracts/common.md#principled-implementation A string-valued source map expresses files the host can write; diagnostics are intentionally opaque because this lane does not consume them.
 * @evidence contracts/common.md#clear-and-simple-design The narrow envelope separates transform payload decoding from compiler result parsing.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The map models the registered transform protocol rather than guessed output for a particular source.
 * @evidence contracts/common.md#meaningful-documentation Native prose defines path and text meaning with tag separation under the documentation skill.
 */
export interface ITypiaTransformOutput {
  diagnostics?: unknown;
  typescript: Record<string, string>;
}

/**
 * Parse the typia transform plugin's stdout into the expected shape. Returns
 * null on any parse / shape mismatch — the caller treats null as "transform
 * produced no usable output".
 *
 * @evidence contracts/common.md#principled-implementation JSON decoding and a non-array object containing only string source values establish the host-write precondition; malformed payloads return null.
 * @evidence contracts/common.md#clear-and-simple-design One decoder validates the source map before the service mutates MemFS.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Rejected payloads remain failures instead of coercing unknown values into source text.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains null's failure meaning and decoding boundary, separated from tags under the documentation skill.
 */
export function safeParseTypiaTransform(
  text: string,
): ITypiaTransformOutput | null {
  try {
    const parsed = JSON.parse(text) as ITypiaTransformOutput;
    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      parsed.typescript &&
      typeof parsed.typescript === "object" &&
      !Array.isArray(parsed.typescript) &&
      Object.values(parsed.typescript).every(
        (value) => typeof value === "string",
      )
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
