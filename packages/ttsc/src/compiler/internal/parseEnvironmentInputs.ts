/**
 * Decode a native `environmentInputs` section: variable names to the value a
 * plugin read through `ctx.Env`, or null for an unset variable.
 *
 * Each entry is a dependency of the whole generation, so a malformed section
 * throws instead of dropping an entry, which would hide an input and let a
 * consumer reuse output computed under another value. An absent or empty
 * section decodes to `undefined`.
 *
 * @evidence contracts/common.md#principled-implementation Names must be non-empty strings and values strings or null; anything else fails the response rather than weakening the input record.
 * @evidence contracts/common.md#clear-and-simple-design One decoder serves the transform envelope and the check/emit observation sidecar, which carry the same field.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No value is read from the current environment and no malformed entry is silently discarded.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the wire shape, the failure policy and why it is strict.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Names and values are retained as producer data; environment name rules belong to the consumers that look them up.
 * @evidence contracts/performance.md#efficient-algorithms One pass over the section's entries; linear in names and value bytes.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each response is decoded independently.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The decoded record transfers to the caller; nothing is retained.
 */
export function parseEnvironmentInputs(
  value: unknown,
): Record<string, string | null> | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("ttsc: invalid native environment input record");
  }
  const output: Record<string, string | null> = {};
  for (const [name, recorded] of Object.entries(value)) {
    if (
      name.length === 0 ||
      (recorded !== null && typeof recorded !== "string")
    )
      throw new Error("ttsc: invalid native environment input entry");
    // A literal wire name must not reach an inherited setter.
    Object.defineProperty(output, name, {
      configurable: true,
      enumerable: true,
      value: recorded,
      writable: true,
    });
  }
  return Object.keys(output).length === 0 ? undefined : output;
}
