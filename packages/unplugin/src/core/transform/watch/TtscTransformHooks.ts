import type { TtscWatchInput } from "./TtscWatchInput";
import type { TtscWatchInputEvidence } from "./TtscWatchInputEvidence";

/**
 * Hooks the bundler adapter passes into `transformTtsc` so transform
 * side-channels (plugin-reported dependencies and host resolver inputs) reach
 * the bundler without leaking extra fields on the returned `TransformResult`.
 */
export interface TtscTransformHooks {
  /**
   * Invoked once per absolute watch-input path derived for the transformed file
   * `F`: the plugin-reported `dependencies[F]` list unioned with the host-owned
   * reference graph's contribution — the reachability closure of `graph.edges`
   * from `F`, the `graph.globals` files, the `graph.configs` chain, importer
   * `graph.candidates`, and universal `graph.resolutionInputs`. For a file the
   * envelope declared `dependenciesComplete`, only `dependencies[F]`,
   * `graph.candidates`, `graph.resolutionInputs`, and the universal
   * `graph.configs` chain remain. Adapters forward this to the bundler's
   * `addWatchFile` so type-only inputs participate in watch-mode and
   * persistent-cache invalidation. See `selectWatchInputs` for the exact
   * derivation.
   */
  addWatchFile?: (file: string, evidence?: TtscWatchInputEvidence) => void;
  /**
   * Batched form of {@link addWatchFile}. When supplied, the transform calls it
   * once per delivered module and does not call `addWatchFile` for that module.
   * `failed` marks a recovery batch: a failed compiler can omit inputs from its
   * previous successful result, so replacing hosts should retain those
   * spellings until the next successful delivery.
   */
  addWatchFiles?: (inputs: readonly TtscWatchInput[], failed?: boolean) => void;
  /**
   * Invoked when the plugin declared the transformed file volatile (the
   * envelope's `volatile` list): its output depends on non-file inputs that no
   * file-dependency snapshot can represent. Adapters should mark the module
   * uncacheable where the bundler exposes that control (e.g. a webpack loader
   * context's `cacheable(false)`).
   */
  markVolatile?: () => void;
}
