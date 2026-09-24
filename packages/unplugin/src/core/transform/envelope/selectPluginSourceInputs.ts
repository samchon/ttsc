import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

/**
 * The plugin source directories of a generation, each with the state the
 * envelope reported for it, by absolute spelling (samchon/ttsc#1487).
 *
 * A plugin's binary is keyed on its Go source and the environment a build there
 * runs in, so the generation's output is a function of these directories as
 * much as of its host inputs: they are universal inputs of every module, proven
 * by state (`pluginSourceHolds`, samchon/ttsc#1493) and observed as whole
 * subtrees. A malformed entry is left out, since a state that is not a string
 * proves nothing. Read once per envelope, since every watch input of every
 * module asks it.
 *
 * @param result The generation's envelope.
 */
export function selectPluginSourceInputs(
  result: ITtscCompilerTransformation,
): ReadonlyMap<string, string> {
  const memo = PLUGIN_SOURCE_INPUTS.get(result);
  if (memo !== undefined) return memo;
  const inputs = new Map<string, string>();
  PLUGIN_SOURCE_INPUTS.set(result, inputs);
  if (result.type === "exception") return inputs;
  for (const [directory, digest] of Object.entries(
    result.pluginSources ?? {},
  )) {
    if (typeof digest !== "string" || directory.length === 0) continue;
    inputs.set(path.resolve(directory), digest);
  }
  return inputs;
}

/** The plugin source directories of each envelope, read once. */
const PLUGIN_SOURCE_INPUTS = new WeakMap<
  ITtscCompilerTransformation,
  ReadonlyMap<string, string>
>();
