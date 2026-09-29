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
 *
 * @evidence contracts/common.md#principled-implementation Optional module callbacks and project registration represent the host's two dependency models, with membership and volatility retaining information a simple file list cannot express.
 * @evidence contracts/common.md#clear-and-simple-design Named callback signatures preserve function-property variance and leave registration policy with the host rather than introducing a second host abstraction.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Hosts use explicit callbacks and tool-directory capabilities, not mutation of bundler internals or fabricated file dependencies for volatile output.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish module and project hosts, recovery batches, unwritable records and volatility; spaced member comments and separated tags follow documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation Absolute native watch spellings and host-owned tool directories cross this explicit boundary; no OS name or fixed directory determines their capabilities.
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
  addWatchFile?: TtscAddWatchFile;

  /**
   * Batched form of {@link addWatchFile}. When supplied, the transform calls it
   * once per delivered module and does not call `addWatchFile` for that module.
   * `failed` marks a recovery batch: a failed compiler can omit inputs from its
   * previous successful result, so replacing hosts should retain those
   * spellings until the next successful delivery.
   */
  addWatchFiles?: TtscAddWatchFiles;

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
    register: TtscRegisterWatchProject;

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
  markVolatile?: TtscMarkVolatile;
}

/**
 * Receive one absolute watch spelling and its optional generation facts.
 *
 * @evidence contracts/common.md#principled-implementation The two parameters keep the host's lexical registration key separate from optional evidence used to validate that input.
 * @evidence contracts/common.md#clear-and-simple-design A named function type retains the original callback-property signature and optional evidence without method bivariance.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts This supported callback boundary supplies dependencies without replacing host methods or inventing observations.
 * @evidence contracts/common.md#meaningful-documentation Native prose describes spelling and optional facts; the owning member documents derivation, with a blank tag separator following documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation The callback receives a native absolute spelling and generation-owned identity facts; it does not impose path case policy on the host.
 */
export type TtscAddWatchFile = (
  file: string,
  evidence?: TtscWatchInputEvidence,
) => void;

/**
 * Receive a readonly input batch; failed batches retain recovery dependencies.
 *
 * @evidence contracts/common.md#principled-implementation The batch and optional failure flag express replacement versus recovery delivery without erasing per-input evidence.
 * @evidence contracts/common.md#clear-and-simple-design A single named function signature preserves the optional flag and original function-property assignability.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Recovery is an explicit host contract rather than successful evidence manufactured for a failed compile.
 * @evidence contracts/common.md#meaningful-documentation Native prose and the owning member explain readonly batching and failed retention; separated tags follow documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation Native input spellings and filesystem identities remain in the documented input carrier without conversion to platform guesses.
 */
export type TtscAddWatchFiles = (
  inputs: readonly TtscWatchInput[],
  failed?: boolean,
) => void;

/**
 * Hand a host the project record and its watching inputs for this delivery.
 *
 * @evidence contracts/common.md#principled-implementation The registration carrier supplies the record path, failure state and input snapshot callback needed by a project-based host.
 * @evidence contracts/common.md#clear-and-simple-design A named callback signature preserves the nested property contract without adding a runtime wrapper or changing method variance.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Registration uses the supported host callback rather than patching its watcher or cache internals.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies the delivery role and the registration type documents the payload, with separated tags following documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation The payload carries the record's actual native path; the host selects its writable location through the existing project boundary.
 */
export type TtscRegisterWatchProject = (
  registration: TtscProjectRegistration,
) => void;

/**
 * Mark the delivered module uncacheable when file dependencies cannot cover it.
 *
 * @evidence contracts/common.md#principled-implementation A no-argument notification expresses the current delivery's volatility without pretending that a synthetic file captures non-file dependencies.
 * @evidence contracts/common.md#clear-and-simple-design The named callback retains the existing function-property signature and leaves each bundler's cache control with its adapter.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The supported notification exposes uncertainty instead of forcing a cache hit through hidden host mutation.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the uncacheable effect and the owning member explains its triggers; separated tags follow documentation guidance.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This no-argument cache-control notification carries no native filesystem or process representation.
 */
export type TtscMarkVolatile = () => void;
