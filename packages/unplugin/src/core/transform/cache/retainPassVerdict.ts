import type { ITtscCompilerTransformation } from "ttsc";

import { TtscPassVerdictError } from "../errors/TtscPassVerdictError";
import type { TtscTerminalGenerationError } from "../errors/TtscTerminalGenerationError";
import { TERMINAL_TRANSFORM_GENERATIONS } from "./TERMINAL_TRANSFORM_GENERATIONS";
import type { TtscCachedProjectTransform } from "./TtscCachedProjectTransform";
import type { TtscTransformCache } from "./TtscTransformCache";

/**
 * Retain the verdict of a compile this pass already attempted, or return
 * `undefined` when nothing may be retained.
 *
 * Only inside a delivery pass. A pass is the window in which every delivery is
 * settled against the state the pass started from, so an attempt it already
 * made is part of that state and the remaining modules replay it rather than
 * each repeating a whole-project transform to reach the same answer. Outside a
 * pass there is no such window, and a long-lived worker must keep retrying on
 * its very next delivery so a transient host failure never becomes permanent.
 */
export function retainPassVerdict(
  cache: TtscTransformCache | undefined,
  key: string,
  generation: Promise<TtscCachedProjectTransform>,
  epoch: number | undefined,
  result: ITtscCompilerTransformation,
  error: unknown,
): TtscTerminalGenerationError | undefined {
  // Only an envelope that failed outright is a statement about the generation.
  // `selectTransformedSource` also throws for a file the compile simply has no
  // output for, which is an ordinary condition for a module the bundle reaches
  // but the tsconfig program does not contain, and which says nothing about the
  // other modules. Retaining that would fail the whole pass, naming a file none
  // of them asked about.
  if (
    result.type === "success" ||
    epoch === undefined ||
    cache?.get(key) !== generation
  ) {
    return undefined;
  }
  const existing = TERMINAL_TRANSFORM_GENERATIONS.get(generation);
  if (existing !== undefined) {
    return existing;
  }
  const verdict = new TtscPassVerdictError(error, epoch);
  TERMINAL_TRANSFORM_GENERATIONS.set(generation, verdict);
  return verdict;
}
