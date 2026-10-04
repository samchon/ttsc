import type {
  ITtscCapabilityPlugin,
  ITtscCapabilityPluginResolution,
} from "../ITtscCapabilityPlugin";

/**
 * Project capability selection and the resolver's caught unavailable outcome.
 * These operations consume supplied discovery values; they neither acquire
 * runtime authority nor establish the validity of a descriptor's observations.
 *
 * @evidence contracts/common.md#principled-implementation Exact true declarations select nonempty binaries in input order; caught task failures remain unavailable rather than reusable empty success.
 * @evidence contracts/common.md#clear-and-simple-design One internal concern owns selection and degraded result construction, without moving authority acquisition into its catch.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Supplied values are not native proof and no runtime, evaluator or compiler is substituted.
 * @evidence contracts/common.md#meaningful-documentation Native prose separates supplied selection policy from discovery, authority and later freshness.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation The namespace groups data-selection and outcome functions; its initialization performs no native path, filesystem or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms The namespace itself defines members without computing a selection or executing a task; each operation owns its processing choices.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The namespace owns no computed answer or reusable cache; resolver authority and persistence remain outside it.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The namespace owns no retained result collection, native handle or task lifecycle.
 */
export namespace CapabilityPluginResult {
  /**
   * Select declarations while forwarding the complete manifest and opted-in
   * project context. Returned objects are fresh; their string values are kept.
   *
   * @evidence contracts/common.md#principled-implementation Only exact true declarations and nonempty binaries qualify; context requires its own true declaration and nonnull input.
   * @evidence contracts/common.md#clear-and-simple-design One ordered filter and projection preserve the existing result shape.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Selection never narrows the complete supplied manifest or invents acquired context.
   * @evidence contracts/common.md#meaningful-documentation Native prose identifies fresh result objects and the separate context gate.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Binary, manifest and context strings are forwarded unchanged as supplied data; selection neither interprets native paths nor acquires a process or filesystem observation.
   * @evidence contracts/performance.md#efficient-algorithms For P supplied entries and Q admitted entries, one filter scans P and one map projects Q, with an intermediate Q-reference array and Q fresh result objects. Declaration lookups are ordinary property access; manifest/context strings are referenced rather than parsed or copied.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This projection decides no discovery freshness or expensive-computation reuse; the resolver owns those premises and this operation constructs fresh results each time.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Returned storage grows with Q admitted entries and retains supplied string values until its caller releases it. The operation stores no history, cache, callback or native handle beyond the returned caller-owned objects.
   */
  export function select(
    resolution: {
      manifest: string;
      projectContext: string | null;
      plugins: readonly {
        binary: string;
        capabilities: Record<string, boolean>;
      }[];
    },
    capability: string,
  ): ITtscCapabilityPlugin[] {
    return resolution.plugins
      .filter(
        (plugin) =>
          plugin.binary !== "" && plugin.capabilities[capability] === true,
      )
      .map((plugin) => ({
        binary: plugin.binary,
        manifest: resolution.manifest,
        ...(plugin.capabilities.projectContextArgs === true &&
        resolution.projectContext !== null
          ? { projectContext: resolution.projectContext }
          : {}),
      }));
  }

  /**
   * Construct fresh degraded absence with no reusable freshness claim.
   *
   * @evidence contracts/common.md#principled-implementation Unavailability always returns false freshness and an empty selection.
   * @evidence contracts/common.md#clear-and-simple-design A single constructor owns this existing outcome shape.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Degraded absence is not evidence of missing publishers.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes unavailable from resolved empty success.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This constructor creates status data and a false predicate without native paths, I/O or platform decisions.
   * @evidenceExclude contracts/performance.md#efficient-algorithms Fixed empty-result construction performs no input traversal or processing-strategy choice.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A fresh degraded result supplies no reusable computation or validity decision; its predicate is always false.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The caller owns plain returned data and a predicate capturing no external state; the constructor retains no collection, task or native handle.
   */
  export function unavailable(): ITtscCapabilityPluginResolution {
    return { isCurrent: () => false, plugins: [], status: "unavailable" };
  }

  /**
   * Preserve the resolver's plugin-load/publication catch boundary. Callers
   * acquire authority, inspect caches and resolve tools before supplying this
   * task, so exceptions from those earlier operations remain outside it.
   *
   * @evidence contracts/common.md#principled-implementation Successful tasks retain the exact returned resolution; any exception inside the supplied task becomes unavailable.
   * @evidence contracts/common.md#clear-and-simple-design One synchronous task boundary preserves the existing try/catch without wrapping prior acquisition.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The callback is the actual load/publication operation, not a replacement runtime or native producer.
   * @evidence contracts/common.md#meaningful-documentation Native prose states which exceptions are caught and which caller operations precede it.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Catching the supplied task's exception prescribes no native path or process representation; actual runtime and filesystem effects remain in the resolver task.
   * @evidenceExclude contracts/performance.md#efficient-algorithms This wrapper chooses an outcome for one synchronous task, not that task's discovery, hashing, serialization or build algorithm. Its cost includes the full task, and no constant-time or bounded-native-work claim is made.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The wrapper neither retries nor caches the task and decides no equivalence or freshness; those policies remain with the supplied resolver operation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The wrapper retains neither the task nor its result after returning and acquires no handle or lease; any native resource lifetime and returned freshness closure remain with the task and caller.
   */
  export function fromTask(
    task: () => ITtscCapabilityPluginResolution,
  ): ITtscCapabilityPluginResolution {
    try {
      return task();
    } catch {
      return unavailable();
    }
  }
}
