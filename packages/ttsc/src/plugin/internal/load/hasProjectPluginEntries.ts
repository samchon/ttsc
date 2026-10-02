import type { ITtscProjectPluginConfig } from "../../../structures/ITtscProjectPluginConfig";
import type { ITtscParsedProjectConfig } from "../../../structures/internal/ITtscParsedProjectConfig";
import { ProjectPluginEntries } from "./ProjectPluginEntries";

/**
 * Return `true` when the project has at least one enabled plugin entry.
 *
 * Used by callers that need to skip plugin-specific work when no plugins are
 * configured, without evaluating descriptors or building plugin artifacts.
 * Discovery still resolves the complete entry list before checking presence;
 * omitted entries can therefore read manifests and resolve native packages.
 *
 * @param entries - Explicit entries; `false` always returns `false`.
 *
 * @evidence contracts/common.md#principled-implementation Explicit false disables all plugin discovery; otherwise the shared entry resolver's enabled-not-false predicate checks the same population the loader would consider.
 * @evidence contracts/common.md#clear-and-simple-design The presence query delegates config/package selection to its owner instead of reproducing descriptor evaluation or build logic.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Enabled selection follows declared configuration, without assuming a known package marker or fabricating absence after a resolver error.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc states why the presence query exists and how explicit false differs from omitted entries; prose/tag separation follows the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation The project-entry resolver owns native config/package resolution; this adapter applies no POSIX parsing or additional path/case normalization to its answer.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This query owns no retained handle or cross-call collection; resolved entry wrappers and discovery indexes are invocation-local, with payloads borrowed from the project or parsed manifests.
 * @evidence contracts/performance.md#efficient-algorithms Explicit false avoids discovery. Otherwise resolution materializes all entries before an at-most-linear enabled scan; explicit lists allocate one wrapper per entry, while omitted lists additionally incur ancestor, manifest-byte, dependency and native specifier-resolution work delegated to the entry resolver. No fixed project-size bound is imposed.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This fresh presence observation coordinates no reusable producer result across calls; it neither retains package authority nor promises that subsequent loading avoids discovery again.
 */
export function hasProjectPluginEntries(
  project: ITtscParsedProjectConfig,
  entries?: readonly ITtscProjectPluginConfig[] | false,
): boolean {
  if (entries === false) {
    return false;
  }
  return ProjectPluginEntries.resolvePluginEntries(project, entries).some(
    (entry) => entry.config.enabled !== false,
  );
}
