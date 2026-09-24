import * as pluginSource from "ttsc/plugin-source";

/**
 * The current state of one plugin source directory, by the rule the plugin
 * build keyed its binary on: its sources and the environment a build there is
 * keyed on (`pluginSourceState` from `ttsc/plugin-source`, samchon/ttsc#1487,
 * samchon/ttsc#1493), or `null` when it cannot be read now.
 *
 * A capture records it: an observer's baseline for a registered plugin source,
 * a failed generation's input state, and Metro's key. A proof against a state
 * the envelope or a record carries compares through `pluginSourceHolds`
 * instead, which reads the build environment again before it refutes the state.
 * So a restart, an adopter, or a host's persistent cache under another
 * `GOFLAGS` or Go toolchain refuses output the old binary produced, as it
 * refuses output of an edited source. A directory a file below could not be
 * read from proves nothing, so `null` never equals a recorded state.
 *
 * @param directory The source directory, as the envelope names it.
 */
export function pluginSourceState(directory: string): string | null {
  try {
    return pluginSource.pluginSourceState(directory);
  } catch {
    return null;
  }
}
