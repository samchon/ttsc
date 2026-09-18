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
