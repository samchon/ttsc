import type { TtscRollupDelivery } from "./TtscRollupDelivery";

/**
 * How the adapter answers Rollup's cache for the modules it delivers
 * (`createRollupCachedModuleProof`): each delivery leaves its project record's
 * state in the module's `meta`, and a module Rollup would serve from its cache
 * runs again when that state is not the record's now.
 */
export interface RollupCachedModuleProof {
  /**
   * Open a build: forget every record proven and read for the last one, since
   * anything may have moved them since.
   */
  begin(): void;
  /**
   * Take what one delivery was handed, and return the `meta` the module carries
   * into Rollup's cache.
   *
   * @param delivery The options the delivery was compiled under and the record
   *   it was handed, or `null` for a delivery no cache may serve.
   */
  deliver(delivery: TtscRollupDelivery): Record<string, TtscRollupDelivery>;
  /**
   * Whether Rollup must transform a module it would otherwise serve from its
   * cache, the answer of `shouldTransformCachedModule`. A module the adapter
   * does not transform is not its to answer.
   *
   * @param module The module as Rollup's cache holds it.
   */
  moved(module: { id: string; meta?: Record<string, unknown> }): boolean;
}
