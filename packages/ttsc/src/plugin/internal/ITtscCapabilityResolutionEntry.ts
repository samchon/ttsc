import type { ITtscCapabilityResolutionPlugin } from "./ITtscCapabilityResolutionPlugin";

/**
 * The answer `resolveCapabilityPlugins` produced for one project, and the exact
 * state that makes it still true.
 *
 * The answer is small and fully serializable — a binary path, a capability map,
 * a manifest string — which is why it is cached here and not one layer down.
 * `loadProjectPlugins` returns live plugin descriptors the compiler drives, and
 * writing those to disk would be caching a different, much larger thing.
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
   * Fingerprint per plugin Go source directory.
   *
   * The binary path is content-keyed on that source, so a source edit produces
   * a different path — and the cached entry would keep naming the old one,
   * which still exists because the build cache retains it. Nothing in the host
   * inputs moves when a plugin's own Go changes, so this is what notices.
   */
  sources: Record<string, string>;
  /** The `--plugins-json` payload, verbatim. */
  manifest: string;
  /** The `--project-context-json` payload, or `null` when none was wanted. */
  projectContext: string | null;
  /** One entry per configured native plugin, in configured order. */
  plugins: ITtscCapabilityResolutionPlugin[];
}
