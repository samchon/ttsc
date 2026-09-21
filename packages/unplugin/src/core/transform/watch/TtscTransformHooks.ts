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
   * Whether the batch also carries the project's root-file membership: one
   * input for the project root, of kind `membership` (samchon/ttsc#1419).
   *
   * A watching host needs it to hear that a file the tsconfig includes appeared
   * or disappeared, since no compiler input changes when one does. A host that
   * already re-keys on the whole project walk, as `@ttsc/metro` does, leaves it
   * out.
   */
  membership?: boolean;
  /**
   * The host's tool directory (`hostToolDirectory`), where the bridge keeps its
   * sentinels and the adapter its membership records. With `membership`, every
   * delivery also hands the host the project's membership record file
   * (`projectMembershipRecordInput`), the membership as a file the host's
   * persistent cache can record (samchon/ttsc#1468). Absent, no record is
   * written or handed.
   */
  toolDirectory?: string;
  /**
   * Invoked when the plugin declared the transformed file volatile (the
   * envelope's `volatile` list): its output depends on non-file inputs that no
   * file-dependency snapshot can represent. Adapters should mark the module
   * uncacheable where the bundler exposes that control (e.g. a webpack loader
   * context's `cacheable(false)`).
   */
  markVolatile?: () => void;
  /**
   * A path spelled the way the host's watch channel names the project, when
   * that channel relates every input to a root of its own rather than to the
   * module it delivered: Farm relates each watch file to its configured root,
   * so an input is handed under that root's spelling, whichever spelling Farm's
   * resolver delivered the module under (samchon/ttsc#1462). Absent, the
   * delivered module decides the spelling (`hostSpelling`).
   */
  spelling?: string;
}
