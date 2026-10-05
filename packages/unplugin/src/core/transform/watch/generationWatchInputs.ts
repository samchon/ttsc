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
 * The record uses a conservative generation-wide selection: every realized or
 * resolver-input path of the graph (edge sources and targets, globals, the
 * config chain, resolution inputs, and every candidate), every plugin-reported
 * dependency, universal host input and plugin source directory. Graph sources
 * are retained directly even when a per-file list excludes its own delivered
 * spelling or admits a complete plugin declaration. This is not an exact union
 * of all narrowed per-file watch lists. The disposed transform scratch tree is
 * dropped, and so is the temporary tsconfig the compile ran under.
 *
 * Memoized per generation. Project-record delivery can separately add configs
 * consulted while routing another module; this generation-wide input union
 * retains one readonly snapshot. Consumers must not mutate its array or
 * entries.
 *
 * Every path is the compiler's own spelling: the record is read by the adapter
 * alone, and the host is handed only the record.
 *
 * @evidence contracts/common.md#principled-implementation The union covers compiler graph, reported dependencies, host inputs and plugin-source roots while excluding disposed scratch and temporary configuration paths.
 * @evidence contracts/common.md#clear-and-simple-design A single append boundary centralizes lexical deduplication and evidence mapping; the memo returns one generation-wide readonly snapshot.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Scratch exclusion reflects disposed ownership, and dependency entries are validated before path use rather than supplemented with consumer-specific guesses.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains generation-wide derivation and memoization; callers must treat the returned array and its entries as immutable, with separated tags following documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation Native path resolution and generation identity preserve filesystem semantics; lexical spellings remain distinct registration keys even when their physical identities agree.
 * @evidence contracts/performance.md#efficient-algorithms Cold selection can build graph and plugin-source indexes before scanning graph member spellings, every dependency occurrence and host/plugin lists. Each occurrence pays lexical path/scratch/key work; unique inputs additionally derive evidence with native identity/project-key queries and any cold observation costs. Temporary member arrays/indexes and output grow with producer/query populations and retained text; duplicates skip evidence conversion only after append checks. A completed generation snapshot needs only WeakMap entry selection.
 * @evidence contracts/performance.md#reuse-equivalent-work The WeakMap shares the completed input union by cached-generation identity. Result/root/scratch/temporary options, recorded evidence and its native identity view must remain valid for that generation; callers must not mutate the shared array or entries. A new cached generation receives a distinct selection without granting freshness from this memo alone.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The owner retains one input array per cached generation, containing unique lexical keys, evidence carriers and references to recorded payloads; sizes follow selected populations and text without a byte cap. Weak keys do not keep generations alive, but a borrower can retain the array/evidence after generation release. Shared derivation indexes have their own state owner; no watcher handle is acquired here.
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
