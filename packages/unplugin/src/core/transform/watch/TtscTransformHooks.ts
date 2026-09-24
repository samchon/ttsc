import type { TtscProjectRegistration } from "./TtscProjectRegistration";
import type { TtscWatchInput } from "./TtscWatchInput";
import type { TtscWatchInputEvidence } from "./TtscWatchInputEvidence";

/**
 * How a host learns what one delivery depends on. A host takes one of two
 * shapes:
 *
 * - A host that keys each module on the inputs of that module alone, such as
 *   `@ttsc/metro`'s fingerprint or a Vite dev server's module graph, takes them
 *   through {@link addWatchFile} or {@link addWatchFiles}.
 * - A build host, which watches files and snapshots them in a persistent cache,
 *   takes the project's record through {@link project}: a generation compiles
 *   the whole project, so a module's output is a function of the project's
 *   state and of nothing finer, and the record is that state as one file.
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
   * `graph.configs` chain remain. See `selectWatchInputs` for the exact
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
   * Whether the batch of {@link addWatchFile} or {@link addWatchFiles} also
   * carries the project's root-file membership: one input for the project root,
   * of kind `membership` (samchon/ttsc#1419), which a dev server's watcher
   * observes by walking the project again. A host that already re-keys on the
   * whole project walk, as `@ttsc/metro` does, leaves it out. A build host's
   * record ({@link project}) always carries it.
   */
  membership?: boolean;
  /**
   * A build host's registration: the transform writes the project's record
   * below `toolDirectory` (`projectRecordFile`) to the generation's state and
   * hands it over once per delivery, with the generation's inputs for a
   * watching session's bridge (`registerProjectRecord`).
   */
  project?: {
    /** Called once per delivery, failed deliveries included. */
    register: (registration: TtscProjectRegistration) => void;
    /** The host's tool directory (`hostToolDirectory`), where the record lives. */
    toolDirectory: string;
    /**
     * Where the record lives when `toolDirectory` cannot be written
     * (`fallbackToolDirectory`, samchon/ttsc#1480), or `undefined` for a host
     * that accepts no record outside its root, or none this user can write.
     */
    fallbackToolDirectory?: string;
    /**
     * Whether the host watches this session. A successful delivery that can be
     * handed no record would be served from the host's watcher's silence after
     * a type-only edit, so it fails instead
     * (`TtscProjectRecordUnwritableError`); a host that cannot tell whether it
     * watches, esbuild, leaves this unset.
     */
    watching?: boolean;
  };
  /**
   * Invoked when the module's output depends on inputs no file-dependency
   * snapshot of the module represents: the plugin declared the transformed file
   * volatile (the envelope's `volatile` list), or the module was handed over
   * without the project's record, which could not be written. Adapters should
   * mark the module uncacheable where the bundler exposes that control (e.g. a
   * webpack loader context's `cacheable(false)`), or answer the bundler's cache
   * for it where the bundler asks instead (Rollup's
   * `shouldTransformCachedModule`, through the module's `meta`).
   */
  markVolatile?: () => void;
}
