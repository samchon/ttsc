/**
 * Convert captured output to UTF-8 text; absent output becomes an empty string.
 *
 * @evidence contracts/common.md#principled-implementation Nullish outputs denote no captured bytes; existing strings retain their decoded meaning and Buffers use Node's UTF-8 decoder.
 * @evidence contracts/common.md#clear-and-simple-design One narrowing branch distinguishes absence from an already decoded string and raw bytes; no process policy belongs to this accessor.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Empty text follows the nullish capture representation and never replaces a nonempty Buffer or a filesystem error.
 * @evidence contracts/common.md#meaningful-documentation The native sentence explains absence and the decoding choice without repeating the union type, following the documentation skill.
 */
export function outputText(value: string | Buffer | null | undefined): string {
  if (value == null) {
    return "";
  }
  return typeof value === "string" ? value : value.toString("utf8");
}
