/**
 * Typia transform stdout envelope; typescript maps virtual paths to source text.
 *
 * @evidence contracts/common.md#principled-implementation A string-valued source map expresses files the host can write; diagnostics are intentionally opaque because this lane does not consume them.
 * @evidence contracts/common.md#clear-and-simple-design The narrow envelope separates transform payload decoding from compiler result parsing.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The map models the registered transform protocol rather than guessed output for a particular source.
 * @evidence contracts/common.md#meaningful-documentation Native prose defines path and text meaning with tag separation under the documentation skill.
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition declares a shape and retains no state or handle.
  * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition declares a shape and performs no computation.
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition declares a shape and shares no computation.
  * @evidenceExclude contracts/portability.md#os-neutral-implementation A type definition owns no native filesystem, path or process decision.
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
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources It keeps no state, handle or listener after returning.
  * @evidenceExclude contracts/performance.md#efficient-algorithms A single pass or constant work over its arguments; no algorithm choice scales beyond that.
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call serves one request; there is no equivalent work to share across calls.
  * @evidenceExclude contracts/portability.md#os-neutral-implementation Works on in-memory strings and the wasm virtual filesystem; it reaches no native filesystem, path-identity or process boundary.
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
      Object.values(parsed.typescript).every((value) => typeof value === "string")
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
