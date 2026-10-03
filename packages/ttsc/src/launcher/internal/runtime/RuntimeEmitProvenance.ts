import path from "node:path";

/**
 * Validate the serialized source ownership supplied by a completed compiler
 * emit.
 *
 * Keys name absolute native output files; each value names the absolute native
 * sources that actually contributed to that written output. Validation checks
 * representation, not whether the compiler observations themselves are
 * trusted.
 *
 * @evidence contracts/common.md#principled-implementation One record grammar preserves actual output-to-source observations across manifest and cache-marker JSON instead of reconstructing ownership from stems or optional source maps.
 * @evidence contracts/common.md#clear-and-simple-design The namespace owns shared transport validation for both runtime readers; producer observation and unique physical ownership stay with the compiler and ownership index.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Representation checks do not fabricate missing provenance or accept a known output filename as proof of which source compiled it.
 * @evidence contracts/common.md#meaningful-documentation Separate native paragraphs define absolute output/source spelling and the distinction between syntactic validation and trusted producer observations.
 * @evidence contracts/portability.md#os-neutral-implementation Native path.isAbsolute validates transported filesystem filenames; it does not lower-case them or confuse slash-separated output-list keys with native absolute paths.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms This namespace groups transport validation; isRecord owns the traversal strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This grouping owns no request cache or shared completed emit.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The namespace retains no record, descriptor or task.
 */
export namespace RuntimeEmitProvenance {
  /**
   * Whether a decoded value has the compiler's absolute output-to-sources
   * shape. An empty record is valid transport shape, distinct from absent
   * provenance; the predicate does not authenticate a producer's observation
   * that no output owns a source.
   *
   * @evidence contracts/common.md#principled-implementation A nonarray object with absolute native output keys and arrays of absolute native source names preserves each recorded mapping; an empty object remains distinct from absent provenance.
   * @evidence contracts/common.md#clear-and-simple-design One type predicate validates the same nested record for manifest inheritance and generation reuse without adding a runtime wrapper around the observed data.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing or malformed provenance is rejected rather than rebuilt from filename extensions or a source-map guess.
   * @evidence contracts/common.md#meaningful-documentation Native prose identifies decoded transport scope and valid empty-record shape without certifying producer completeness or ownership observations.
   * @evidence contracts/portability.md#os-neutral-implementation path.isAbsolute applies the consuming host's native filename grammar; filesystem identity and alias equivalence remain the ownership index's responsibility.
   * @evidence contracts/performance.md#efficient-algorithms One visit per output and contributing source costs O(O + S) entries plus path characters; Object.entries temporarily stores O(O) pairs, with early rejection and no filesystem reads or recursive source-tree enumeration.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This predicate owns no cross-reader computation coordinator, independent cache or invalidation identity for mutable caller records; readers choose when to revalidate transported values.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The synchronous predicate retains no mapping history or native resource; validated data remains reader-owned.
   */
  export function isRecord(
    value: unknown,
  ): value is Readonly<Record<string, readonly string[]>> {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }
    for (const [output, sources] of Object.entries(value)) {
      if (
        !path.isAbsolute(output) ||
        !Array.isArray(sources) ||
        !sources.every(
          (source) => typeof source === "string" && path.isAbsolute(source),
        )
      ) {
        return false;
      }
    }
    return true;
  }
}
