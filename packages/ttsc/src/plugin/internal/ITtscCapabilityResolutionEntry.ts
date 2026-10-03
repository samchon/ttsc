import type { ITtscCapabilityPluginSource } from "./ITtscCapabilityPluginSource";
import type { ITtscCapabilityResolutionPlugin } from "./ITtscCapabilityResolutionPlugin";

/**
 * The answer `resolveCapabilityPlugins` produced for one project, and the exact
 * recorded premises the reader rechecks before reusing it.
 *
 * The answer is serializable: a binary path, a capability map,
 * a manifest string — which is why it is cached here and not one layer down.
 * `loadProjectPlugins` returns live plugin descriptors the compiler drives, and
 * writing those to disk would be caching a different, much larger thing.
 *
 * @evidence contracts/common.md#principled-implementation A serializable answer is paired with evaluation-time input hashes/realpaths, plugin build states and format/version identity so reuse can be refused when any premise changes.
 * @evidence contracts/common.md#clear-and-simple-design The cache entry contains the narrow capability answer and its proof data, leaving live descriptor execution state out of persistence.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The reader compares stored source states against the shared selected-source/environment recipe rather than accepting an existing executable alone. Metadata-assisted digest reuse remains conditional on its observation premises; executable existence does not authenticate its bytes.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains why this answer is persisted, source/environment invalidation and verbatim manifest payloads; paragraphs, member and tag spacing follow the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
 */
export interface ITtscCapabilityResolutionEntry {
  /** Cache format plus the ttsc build that wrote it. */
  version: string;

  /** Paths whose state decides whether this answer is still the answer. */
  hostInputs: string[];

  /** Content hash per host input, `null` for one that does not exist. */
  hostInputHashes: Record<string, string | null>;

  /** Recorded resolved-path observation per host input, or null if unavailable. */
  hostInputRealpaths: Record<string, string | null>;

  /**
   * The state of every directory the plugin binaries were keyed on, as the load
   * reported it (`pluginSources`: each module root, linked package, and
   * contributor source, with the Go build environment there).
   *
   * An edit in the selected source population or a changed build-environment
   * observation can change this state while the host inputs remain unchanged.
   * The entry can still name a retained old executable, so the reader compares
   * these states through `pluginSourceStateHolds`. Files outside the build's
   * selected source population are not universally covered, and matching state
   * or executable existence does not authenticate the executable's bytes.
   */
  pluginSources: Record<string, ITtscCapabilityPluginSource>;

  /** The `--plugins-json` payload, verbatim. */
  manifest: string;

  /** The `--project-context-json` payload, or `null` when none was wanted. */
  projectContext: string | null;

  /** One entry per configured native plugin, in configured order. */
  plugins: ITtscCapabilityResolutionPlugin[];
}
