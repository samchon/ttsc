/**
 * What a module the adapter delivered to Rollup carries in its `meta`, under
 * the plugin's name, so that a later build handed Rollup's cache can tell
 * whether the module's output still holds (`createRollupCachedModuleProof`).
 *
 * Rollup keys a cached module by its source alone, neither by the project the
 * adapter compiled it in nor by the adapter's options, so a delivery names
 * both: the options it was compiled under (`rollupDeliveryOptions`), and the
 * project record it was handed with the digest of the bytes its process wrote
 * to it. A delivery that consulted no project, with the plugins disabled, names
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
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   TtscRollupDelivery only declares a shape; it has no filesystem, path or
 *   process operation at runtime.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   TtscRollupDelivery only declares a shape; it has no computation at
 *   runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   TtscRollupDelivery only declares a shape; it has no work to reuse at
 *   runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   TtscRollupDelivery only declares a shape; it has no handle or retained
 *   state at runtime.
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
