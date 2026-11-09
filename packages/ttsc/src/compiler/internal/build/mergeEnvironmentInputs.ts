/**
 * Union the environment reads of the native generations behind one result.
 *
 * Every phase of one compile spawns its plugins under the same environment, so
 * a name normally carries one value across phases. If two phases recorded
 * different values for a name, no single environment reproduces the result: the
 * first value is kept and `observationsComplete: false` withdraws reuse, the
 * same refusal an explicitly incomplete producer causes. The returned object
 * spreads into a result and adds nothing when no phase read a variable.
 *
 * @evidence contracts/common.md#principled-implementation A name is an input of the merged result if any phase read it; contradictory values cannot be satisfied by one environment, so they withdraw reuse instead of picking a winner silently.
 * @evidence contracts/common.md#clear-and-simple-design One merger serves phase composition and the transform router; the existing sticky observation marker carries a conflict rather than a new proof state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No current environment value is read to repair a conflict, and a conflicting name is not dropped, which would hide an input.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains why values normally agree, the conflict policy and the spreadable empty result.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Recorded names and values are compared literally as producer data; native environment name rules belong to the consumers that look them up.
 * @evidence contracts/performance.md#efficient-algorithms One pass over every group's entries with own-key lookups; linear in recorded names.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Combining supplied records coordinates no shared production.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned record transfers to the caller; nothing is retained.
 */
export function mergeEnvironmentInputs(
  ...groups: readonly (Readonly<Record<string, string | null>> | undefined)[]
): {
  /** Union of the recorded reads; absent when no phase read a variable. */
  environmentInputs?: Record<string, string | null>;

  /** Present as false when two phases recorded different values for a name. */
  observationsComplete?: false;
} {
  const merged: Record<string, string | null> = {};
  let conflicting = false;
  for (const group of groups) {
    for (const [name, value] of Object.entries(group ?? {})) {
      if (Object.hasOwn(merged, name)) {
        if (merged[name] !== value) conflicting = true;
        continue;
      }
      // A literal wire name must not reach an inherited setter.
      Object.defineProperty(merged, name, {
        configurable: true,
        enumerable: true,
        value,
        writable: true,
      });
    }
  }
  return {
    ...(Object.keys(merged).length === 0 ? {} : { environmentInputs: merged }),
    ...(conflicting ? { observationsComplete: false as const } : {}),
  };
}
