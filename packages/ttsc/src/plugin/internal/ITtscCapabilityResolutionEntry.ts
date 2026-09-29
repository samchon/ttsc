import type { ITtscCapabilityPluginSource } from "./ITtscCapabilityPluginSource";
import type { ITtscCapabilityResolutionPlugin } from "./ITtscCapabilityResolutionPlugin";

/**
 * The answer `resolveCapabilityPlugins` produced for one project, and the exact
 * state that makes it still true.
 *
 * The answer is small and fully serializable — a binary path, a capability map,
 * a manifest string — which is why it is cached here and not one layer down.
 * `loadProjectPlugins` returns live plugin descriptors the compiler drives, and
 * writing those to disk would be caching a different, much larger thing.
 *
 * @evidence contracts/common.md#principled-implementation A serializable answer is paired with evaluation-time input hashes/realpaths, plugin build states and format/version identity so reuse can be refused when any premise changes.
 * @evidence contracts/common.md#clear-and-simple-design The cache entry contains the narrow capability answer and its proof data, leaving live descriptor execution state out of persistence.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Stored source states prove the binary's real build inputs instead of trusting an existing old executable or a plugin-name guess.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains why this answer is persisted, source/environment invalidation and verbatim manifest payloads; paragraphs, member and tag spacing follow the documentation skill.
 */
export interface ITtscCapabilityResolutionEntry {
  /** Cache format plus the ttsc build that wrote it. */
  version: string;

  /** Paths whose state decides whether this answer is still the answer. */
  hostInputs: string[];

  /** Content hash per host input, `null` for one that does not exist. */
  hostInputHashes: Record<string, string | null>;

  /** Physical identity per host input, so a retargeted link is a change. */
  hostInputRealpaths: Record<string, string | null>;

  /**
   * The state of every directory the plugin binaries were keyed on, as the load
   * reported it (`pluginSources`: each module root, linked package, and
   * contributor source, with the Go build environment there).
   *
   * A binary path is keyed on exactly these, so any edit below one, or another
   * `GOFLAGS` or Go toolchain, produces a different path, and the cached entry
   * would keep naming the old binary, which still exists because the build
   * cache retains it. Nothing in the host inputs moves then, so these states,
   * proven by the build's own rule (`pluginSourceStateHolds`), are what notices
   * (samchon/ttsc#1492).
   */
  pluginSources: Record<string, ITtscCapabilityPluginSource>;

  /** The `--plugins-json` payload, verbatim. */
  manifest: string;

  /** The `--project-context-json` payload, or `null` when none was wanted. */
  projectContext: string | null;

  /** One entry per configured native plugin, in configured order. */
  plugins: ITtscCapabilityResolutionPlugin[];
}
