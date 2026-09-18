import type { ITtscCompilerTransformation } from "ttsc";

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
): string {
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
