import { resolveBinary } from "../compiler/internal/resolveBinary";
import { loadProjectPlugins } from "./internal/loadProjectPlugins";

/**
 * The built sidecars of a project's configured plugins that declare one
 * capability.
 *
 * This is the seam a consumer outside the compiler needs to ask a plugin a
 * question the plugin declared it can answer. `ttscserver` already does this
 * for `capabilities.lsp`, but it does it from inside the launcher; a separate
 * tool — `@ttsc/graph`, an editor integration, a script — had no way to reach
 * the same answer without reimplementing plugin discovery, descriptor
 * evaluation, and the Go source build cache.
 *
 * It is contributor-agnostic by construction: the caller names a capability,
 * not a package. A project that configures no plugin, or none declaring that
 * capability, gets an empty array — which is an answer, not a failure, and is
 * the common case.
 *
 * Building a plugin is not free the first time. The Go source build is cached
 * by content, so a warm project pays a lookup; a cold one pays the build the
 * next `ttsc` invocation would have paid anyway.
 *
 * @param options.capability - Capability flag the plugin descriptor must
 *   declare.
 * @param options.cwd - Project root. Defaults to the current directory.
 * @param options.tsconfig - Project tsconfig path, relative to `cwd`.
 * @returns Absolute executable paths, in configured plugin order.
 */
export function resolveCapabilityPlugins(options: {
  capability: string;
  cwd?: string;
  tsconfig?: string;
}): string[] {
  const binary = resolveBinary();
  if (binary === null || binary === undefined) return [];
  try {
    const loaded = loadProjectPlugins({
      binary,
      cwd: options.cwd,
      tsconfig: options.tsconfig,
    });
    return loaded.nativePlugins
      .filter(
        (plugin) =>
          plugin.binary !== "" &&
          (plugin.capabilities as Record<string, unknown> | undefined)?.[
            options.capability
          ] === true,
      )
      .map((plugin) => plugin.binary);
  } catch {
    // A project whose plugin configuration does not load is a project the user
    // already sees an error for, from the command that compiles it. Failing here
    // would turn "your lint config has a typo" into "the graph is broken", and
    // the caller's own degraded answer is the honest one.
    return [];
  }
}
