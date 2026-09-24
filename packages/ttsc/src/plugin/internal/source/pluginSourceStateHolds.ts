import { pluginSourceDigest } from "./pluginSourceDigest";
import { pluginSourceState } from "./pluginSourceState";
import { processPluginBuildEnvironment } from "./processPluginBuildEnvironment";

/**
 * Whether one plugin source directory still holds the state a transform
 * reported for it (`pluginSourceState`), under this process's environment.
 *
 * The sources are read now. The environment is this process's reading
 * (`processPluginBuildEnvironment`), and when the state does not match it is
 * read again before the state is refuted: a change no variable carries, `go env
 * -w` or a toolchain replaced in place, reaches the process's reading through
 * the first proof it fails. A compile keys its binaries on a fresh read, so a
 * state it reported after such a change is matched on the second reading, and
 * no consumer keeps refuting output its own compiler just produced.
 *
 * @param directory The source directory, as the envelope names it.
 * @param state The state the envelope reported.
 * @throws When a listed source file cannot be read, as the build itself would.
 */
export function pluginSourceStateHolds(
  directory: string,
  state: string,
): boolean {
  const sourceDigest = pluginSourceDigest(directory);
  if (pluginSourceState(directory, { sourceDigest }) === state) return true;
  processPluginBuildEnvironment(directory, true);
  return pluginSourceState(directory, { sourceDigest }) === state;
}
