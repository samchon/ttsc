import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

import { toProjectKey } from "../project/toProjectKey";
import { createEnvelopeKeyIndex } from "./createEnvelopeKeyIndex";
import { derivationIdentity } from "./derivationIdentity";
import { envelopeDerivation } from "./envelopeDerivation";

/**
 * Extract the absolute, lexical-spelling-deduplicated dependency list for a
 * single file from the compiler result. Mirrors `selectTransformedSource`'s key
 * lookup: fast project-relative match first, then a per-envelope identity
 * index. Distinct lexical aliases must survive so bundlers observe a later
 * symlink or junction retarget. Returns an empty list on exceptions or when the
 * plugin reported nothing.
 *
 * @evidence contracts/common.md#principled-implementation Exact project keys take precedence and a physical-identity index handles alternate producer spellings; returned dependencies resolve against the project root but deduplicate lexically so alias retargeting remains observable.
 * @evidence contracts/common.md#clear-and-simple-design Lookup and list normalization are local stages, while generation ownership, project key semantics and identity indexing stay with their shared helpers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Only own producer entries can take exact-key precedence; inherited object members cannot suppress alternate-spelling fallback. Actual absolute/relative keys retain first-match precedence, and malformed lists yield no guessed dependencies.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains empty outcomes, exact/fallback key lookup and why lexical aliases survive; tags have a separate block under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native path.resolve handles dependency spelling, while toProjectKey and the shared identity context handle physical key matching without assuming case sensitivity or path separators from the OS name.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The index retains at most one producer list per physical key on weak generation state; returned arrays belong to callers, and temporary deduplication sets or filesystem handles are not retained by this selector.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Native project-key/path/identity work precedes the own record lookup. Cold
 *   fallback materializes producer entries and resolves their identities;
 *   later requests share that index. Each selected dependency occurrence still
 *   resolves native lexical text and probes a Set before output, even when
 *   duplicated. Query/list/producer path text, native context observations and
 *   temporary entry pairs/normalized arrays drive costs, not only list count.
 * @evidence contracts/performance.md#reuse-equivalent-work The dependency index shares the immutable envelope's producer map and root across deliveries; normalization still returns a fresh array because only keyed lookup, not the final list, is memoized here.
 */
export function selectFileDependencies(props: {
  file: string;
  projectRoot: string;
  result: ITtscCompilerTransformation;
}): string[] {
  if (props.result.type === "exception") {
    return [];
  }
  const dependencies = props.result.dependencies;
  if (dependencies === undefined) {
    return [];
  }
  const state = envelopeDerivation(props);
  const key = toProjectKey(
    props.projectRoot,
    props.file,
    state.identityContext,
  );
  let entries = Object.prototype.hasOwnProperty.call(dependencies, key)
    ? dependencies[key]
    : undefined;
  if (entries === undefined) {
    const index = (state.dependencyIndex ??= createEnvelopeKeyIndex(
      state,
      props.projectRoot,
      dependencies,
    ));
    entries = index.get(derivationIdentity(state, props.file)) as
      | string[]
      | undefined;
  }
  if (!Array.isArray(entries)) {
    return [];
  }
  const output: string[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (typeof entry !== "string" || entry.length === 0) {
      continue;
    }
    const absolute = path.resolve(props.projectRoot, entry);
    if (seen.has(absolute)) {
      continue;
    }
    seen.add(absolute);
    output.push(absolute);
  }
  return output;
}
