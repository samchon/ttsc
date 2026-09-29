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
 *
 * @evidence contracts/common.md#principled-implementation The shared pluginSourceState composition combines source digest and build environment exactly as binary keys do, and an observation error preserves null rather than a plausible state.
 * @evidence contracts/common.md#clear-and-simple-design Capture delegates state composition to ttsc while proof callers use pluginSourceHolds for mismatch refresh; the two roles are explicit without duplicate key logic.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing observations cannot become hardcoded state or equal a recorded valid state through an exception branch.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs identify capture consumers, proof delegation, environment changes and null meaning, with separated tags under documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral state observes the shared source and Go/toolchain environment boundaries used by native builds instead of inferring equivalence from one platform name or assumed tool location.
 */
export function pluginSourceState(directory: string): string | null {
  try {
    return pluginSource.pluginSourceState(directory);
  } catch {
    return null;
  }
}
