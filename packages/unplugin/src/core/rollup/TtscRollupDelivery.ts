/**
 * What a module the adapter delivered to Rollup carries in its `meta`, under
 * the plugin's name, so that a later build handed Rollup's cache can tell
 * whether the module's output still holds (`createRollupCachedModuleProof`).
 *
 * Host module caching does not independently validate this adapter's current
 * project and options. A delivery therefore names its option identity
 * (`rollupDeliveryOptions`) and the
 * project record it was handed with the digest of the bytes its process wrote
 * to it. A delivery that consulted no project, such as disabled plugins, names
 * no record. A delivery no cache may serve carries `null`: one handed no record
 * its process wrote, and one whose output the plugin declared volatile, which
 * depends on inputs no file stands for.
 *
 * Rollup keeps a module's `meta` in its cache, and restores it with the module,
 * so the value is plain JSON.
 *
 * @evidence contracts/common.md#principled-implementation Option identity and optional record digest preserve the configuration and input-state conditions under which this module was delivered; null explicitly denies cache reuse.
 * @evidence contracts/common.md#clear-and-simple-design Plain JSON metadata stores only proof references rather than the generation or native observation resources.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing record and null have distinct meanings, so a volatile or unprovable delivery cannot masquerade as a disabled-plugin pass-through.
 * @evidence contracts/common.md#meaningful-documentation The prose explains host source-only caching, option identity, optional records, null, and serializable metadata ownership.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Optional record.file carries the producer's native project-record filename.
 *   It stays distinct from option identity/digest and host module id; no URL,
 *   case normalization or physical alias inference changes its spelling.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   The JSON carrier defines option/record fields; production and cache
 *   judgment own encoding, native reads and comparisons.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   The carrier implements no sharing coordinator; per-pass reuse belongs to
 *   the proof instance that consumes these delivered facts.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Host module metadata owns this value's lifetime; the carrier defines no
 *   independent handle/task acquisition or retention policy.
 */
export type TtscRollupDelivery = {
  /** The identity of the options the delivery was compiled under. */
  options: string;

  /**
   * The project record the delivery was handed (`projectRecordFile`), with the
   * digest of the bytes its process wrote to it (`projectRecordDigest`); absent
   * for a delivery that consulted no project.
   */
  record?: {
    digest: string;
    file: string;
  };
} | null;
