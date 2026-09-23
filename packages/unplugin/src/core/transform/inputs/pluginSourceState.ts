import { pluginSourceDigest } from "ttsc/plugin-source";

/**
 * The current state of one plugin source directory, by the rule the plugin
 * build keyed its binary on (`pluginSourceDigest` from `ttsc/plugin-source`,
 * samchon/ttsc#1487), or `null` when it cannot be read now.
 *
 * Every proof of a plugin source compares this against the digest the transform
 * envelope reported (`ITtscCompilerTransformation.pluginSources`): the
 * capture's, each delivery's, a record's at a build start, an observer's
 * re-check, and Metro's key. A directory a file below could not be read from
 * proves nothing, so `null` never equals a recorded digest.
 *
 * @param directory The source directory, as the envelope names it.
 */
export function pluginSourceState(directory: string): string | null {
  try {
    return pluginSourceDigest(directory);
  } catch {
    return null;
  }
}
