/**
 * Validate a persisted plugin environment-read map before it can authorize
 * reuse. Optional-field omission belongs to the reader; a present field must
 * contain nonempty names and string values or null for recorded absence.
 *
 * @evidence contracts/common.md#principled-implementation The complete dictionary must satisfy the native envelope's name/value contract before equality can prove its reads. Arrays and primitive whole fields cannot become an empty dependency set.
 * @evidence contracts/common.md#clear-and-simple-design Shared-publication and project-record readers use one predicate for their common environment witness while retaining ownership of their surrounding schemas.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Invalid records are rejected whole without dropping entries, coercing values or reconstructing an earlier observation from the current environment.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes reader-owned omission from a present dictionary and explains null absence.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This checks decoded JSON names and values without reading native environment state or normalizing platform aliases.
 * @evidence contracts/performance.md#efficient-algorithms Object.entries visits own dictionary entries once; the temporary array grows with the number of recorded reads, and no value bytes are copied or hashed.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each reader validates its newly decoded record; this predicate retains no prior schema verdict.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The call borrows its value and retains no state, handle or history.
 */
export function isEnvironmentInputs(
  value: unknown,
): value is Record<string, string | null> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.entries(value).every(
      ([name, recorded]) =>
        name.length !== 0 &&
        (recorded === null || typeof recorded === "string"),
    )
  );
}
