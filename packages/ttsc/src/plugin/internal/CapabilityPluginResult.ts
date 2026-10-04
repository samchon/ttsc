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
