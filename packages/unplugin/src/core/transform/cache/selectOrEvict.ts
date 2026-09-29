import type { ITtscCompilerTransformation } from "ttsc";

import type { TtscTransformedOutput } from "../envelope/TtscTransformedOutput";
import { selectTransformedSource } from "../envelope/selectTransformedSource";
import type { TtscCachedProjectTransform } from "./TtscCachedProjectTransform";
import type { TtscTransformCache } from "./TtscTransformCache";
import { evictGeneration } from "./evictGeneration";
import { retainPassVerdict } from "./retainPassVerdict";

/**
 * Extract the transformed source, and decide what a throwing generation is.
 *
 * {@link selectTransformedSource} throws for two different reasons, and only one
 * of them is about the generation. A host `"exception"` or a compiler
 * `"failure"` means the compile produced nothing for anyone: inside a pass that
 * verdict is retained and replayed, because evicting it made every remaining
 * module repeat the whole-project transform only to reach the identical answer
 * (samchon/ttsc#1303), and outside a pass it keeps being evicted so a
 * long-lived worker retries on its very next delivery exactly as before.
 *
 * A `"success"` envelope that has no output for the module asking is the other
 * reason, and it is a fact about that one file: an ordinary condition for a
 * module the bundle reaches and the tsconfig program does not contain. It is
 * neither retained nor evicted. The error reaches the caller, and the
 * generation, which compiled perfectly well for every other module, stays.
 *
 * @evidence contracts/common.md#principled-implementation Compiler failure describes the whole generation, while absent output in a successful envelope describes only the requested module; retention and eviction respect that distinction.
 * @evidence contracts/common.md#clear-and-simple-design The gate delegates source extraction and pass-verdict classification before choosing eviction, without duplicating envelope decoding.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A missing module neither fabricates output nor destroys a valid program generation to force a compensating compile.
 * @evidence contracts/common.md#meaningful-documentation Separate paragraphs explain generation-wide failure, pass scope, and ordinary per-file absence so cleanup remains tied to the correct cause.
 * @evidence contracts/performance.md#efficient-algorithms Source extraction and failure classification use the existing generation rather than repeating a project compile for every module lacking output.
 * @evidence contracts/performance.md#reuse-equivalent-work Valid output for other modules remains reusable after one absent module, and one failed generation verdict is reused inside its declared pass.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Failed generations outside pass retention reach the guarded disposer; per-file absence does not release a valid generation owned by the cache.
 */
export function selectOrEvict(
  cache: TtscTransformCache | undefined,
  key: string,
  generation: Promise<TtscCachedProjectTransform>,
  epoch: number | undefined,
  props: {
    file: string;
    projectRoot: string;
    result: ITtscCompilerTransformation;
    tsconfig: string;
  },
): TtscTransformedOutput {
  try {
    return selectTransformedSource(props);
  } catch (error) {
    const verdict = retainPassVerdict(
      cache,
      key,
      generation,
      epoch,
      props.result,
      error,
    );
    if (verdict !== undefined) {
      throw verdict;
    }
    // A generation that compiled fine and simply has no output for the module
    // asking is not a failed generation. Discarding it made every later module
    // recompile the whole project to reach the same answer, which is the cost
    // samchon/ttsc#1303 is about, for a bundle that merely reaches a file the
    // tsconfig program does not contain.
    if (props.result.type !== "success") {
      evictGeneration(cache, key, generation);
    }
    throw error;
  }
}
