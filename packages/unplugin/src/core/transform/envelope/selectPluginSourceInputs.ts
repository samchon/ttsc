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
 *
 * @evidence contracts/common.md#principled-implementation Each valid producer directory/digest pair records a universal plugin-build input; exceptions and malformed entries contribute no proven state rather than implying an empty subtree is unchanged.
 * @evidence contracts/common.md#clear-and-simple-design One weakly memoized map exposes absolute directory spellings and their reported states; subtree observation and digest validation remain with the consuming cache/watch owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Digest values come from the actual envelope and are not recomputed later to retroactively certify the compile; non-string values cannot masquerade as a source-state proof.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain why plugin source trees are universal inputs, what malformed entries mean and generation memoization, with parameter and tag separation following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native path.resolve supplies absolute source-directory spellings; no OS-specific directory names, separator rewriting or case assumptions are introduced by the map adapter.
 * @evidence contracts/performance.md#bound-retention-and-release-resources WeakMap ownership releases the map with its result object; entries grow only with valid producer directories and this adapter does not acquire subtree observers or retain older generations.
 * @evidence contracts/performance.md#efficient-algorithms One pass over pluginSources builds the map once per result, and repeated module queries use the WeakMap instead of rescanning source directories.
 * @evidence contracts/performance.md#reuse-equivalent-work The immutable result object identifies equivalent source-state requests; fresh generation objects build fresh maps, and consumers must not mutate the returned read-only map.
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
