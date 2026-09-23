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
 * Memoized per generation: the record is written once per generation, and each
 * delivery hands the bridge the same inputs. Every path is the compiler's own
 * spelling: the record is read by the adapter alone, and the host is handed
 * only the record.
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
