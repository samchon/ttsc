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
