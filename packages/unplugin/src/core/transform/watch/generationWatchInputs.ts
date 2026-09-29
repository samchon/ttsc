import path from "node:path";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { envelopeDerivation } from "../envelope/envelopeDerivation";
import { envelopeGraphIndexes } from "../envelope/envelopeGraphIndexes";
import { selectHostInputs } from "../envelope/selectHostInputs";
import { selectPluginSourceInputs } from "../envelope/selectPluginSourceInputs";
import { isTransformScratchInput } from "../tsconfig/isTransformScratchInput";
import type { TtscWatchInput } from "./TtscWatchInput";
import { evidencedWatchInput } from "./evidencedWatchInput";

/** One generation's inputs, derived once for every delivery of it. */
const GENERATION_WATCH_INPUTS = new WeakMap<
  TtscCachedProjectTransform,
  readonly TtscWatchInput[]
>();

/**
 * Every input of a generation, with the evidence it recorded: what the
 * project's record holds and a watching session's bridge observes.
 *
 * A generation compiles the whole project, so its inputs are the union over
 * every source file of what `selectWatchInputs` derives for one: every realized
 * or resolver-input path of the graph (edge sources and targets, globals, the
 * config chain, resolution inputs, and every candidate), every plugin-reported
 * dependency, and the universal host inputs. The union is taken directly from
 * the graph's indexes rather than file by file, since the per-file derivation
 * walks the reference closure and the union of those walks is the graph itself.
 * The disposed transform scratch tree is dropped, and so is the temporary
 * tsconfig the compile ran under.
 *
 * Memoized per generation. Project-record delivery can separately add configs
 * consulted while routing another module; this generation-wide input union
 * retains one readonly snapshot. Consumers must not mutate its array or entries.
 *
 * Every path is the compiler's own spelling: the record is read by the adapter
 * alone, and the host is handed only the record.
 *
 * @evidence contracts/common.md#principled-implementation The union covers compiler graph, reported dependencies, host inputs and plugin-source roots while excluding disposed scratch and temporary configuration paths.
 * @evidence contracts/common.md#clear-and-simple-design A single append boundary centralizes lexical deduplication and evidence mapping; the memo returns one generation-wide readonly snapshot.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Scratch exclusion reflects disposed ownership, and dependency entries are validated before path use rather than supplemented with consumer-specific guesses.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains generation-wide derivation and memoization; callers must treat the returned array and its entries as immutable, with separated tags following documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation Native path resolution and generation identity preserve filesystem semantics; lexical spellings remain distinct registration keys even when their physical identities agree.
 * @evidence contracts/performance.md#efficient-algorithms A Set makes the first union linear in candidate count plus path/identity work, retaining only unique inputs and avoiding repeated evidence conversion for duplicates.
 * @evidence contracts/performance.md#reuse-equivalent-work The WeakMap shares the completed input union by cached-generation identity; a newly compiled generation receives a new key and derivation.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Snapshot storage is O(unique generation inputs) per live generation and weak-keyed, so old snapshots become collectible with their generation rather than accumulating in a strong process-wide map.
 */
export function generationWatchInputs(
  cached: TtscCachedProjectTransform,
): readonly TtscWatchInput[] {
  const memo = GENERATION_WATCH_INPUTS.get(cached);
  if (memo !== undefined) return memo;
  const state = envelopeDerivation(cached);
  const props = {
    projectRoot: cached.projectRoot,
    result: cached.result,
    scratchDirectory: cached.scratchDirectory,
    temporaryTsconfig: cached.temporaryTsconfig,
  };
  const temporary =
    cached.temporaryTsconfig === undefined
      ? undefined
      : path.resolve(cached.temporaryTsconfig);
  const seen = new Set<string>();
  const inputs: TtscWatchInput[] = [];
  const append = (input: string): void => {
    const spelling = path.resolve(input);
    if (
      spelling === temporary ||
      isTransformScratchInput(spelling, cached.scratchDirectory) ||
      seen.has(spelling)
    ) {
      return;
    }
    seen.add(spelling);
    inputs.push(evidencedWatchInput(cached, state, spelling, (input) => input));
  };
  if (cached.result.type !== "exception") {
    for (const spelling of envelopeGraphIndexes(state, props).memberSpellings)
      append(spelling);
    for (const entries of Object.values(cached.result.dependencies ?? {})) {
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        if (typeof entry === "string" && entry.length !== 0)
          append(path.resolve(cached.projectRoot, entry));
      }
    }
    for (const input of selectHostInputs(props)) append(input);
    for (const input of selectPluginSourceInputs(cached.result).keys())
      append(input);
  }
  GENERATION_WATCH_INPUTS.set(cached, inputs);
  return inputs;
}
