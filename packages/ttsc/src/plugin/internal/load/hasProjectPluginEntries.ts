import type { ITtscProjectPluginConfig } from "../../../structures/ITtscProjectPluginConfig";
import type { ITtscParsedProjectConfig } from "../../../structures/internal/ITtscParsedProjectConfig";
import { ProjectPluginEntries } from "./ProjectPluginEntries";

/**
 * Return `true` when the project has at least one enabled plugin entry.
 *
 * Used by callers that need to skip plugin-specific work when no plugins are
 * configured, without paying the full cost of `loadProjectPlugins`.
 *
 * @param entries - Explicit entries; `false` always returns `false`.
 *
 * @evidence contracts/common.md#principled-implementation Explicit false disables all plugin discovery; otherwise the shared entry resolver's enabled-not-false predicate checks the same population the loader would consider.
 * @evidence contracts/common.md#clear-and-simple-design The cheap presence query delegates config/package selection to its owner instead of reproducing plugin loading or build logic.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Enabled selection follows declared configuration, without assuming a known package marker or fabricating absence after a resolver error.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc states why the presence query exists and how explicit false differs from omitted entries; prose/tag separation follows the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation The project-entry resolver owns native config/package resolution; this adapter applies no POSIX parsing or additional path/case normalization to its answer.
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
