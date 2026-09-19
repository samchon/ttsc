import { TtscUnstableGenerationError } from "../errors/TtscUnstableGenerationError";
import type { TtscTransformHooks } from "./TtscTransformHooks";
import { notifyFailedGenerationInputs } from "./notifyFailedGenerationInputs";

/**
 * Register the recovery inputs of a delivery whose generation was rejected
 * before it produced a result, so the host re-runs the module when they
 * change.
 *
 * A generation can end in a rejection rather than a failed envelope: the
 * project moved under two consecutive attempts (`TtscUnstableGenerationError`),
 * or the compile could not start at all. A delivery that surfaced such a
 * rejection without registering anything left its module with no dependencies
 * on a host that records them per run, as Turbopack does, so no later edit
 * re-ran it and the page kept the error. Measured on real `next dev` in about
 * one run of twenty, when the four modules of the page compiled in parallel
 * right after a breaking edit (samchon/ttsc#1446).
 *
 * An unstable generation keeps its last attempt as the validation baseline,
 * whose inputs are exactly what a failed envelope of that attempt would
 * register. Any other rejection has no generation to describe; the delivery
 * then registers what it can always name, its selection inputs, so at least a
 * configuration edit reaches the module again, and the host's own watch of the
 * module's source covers the rest.
 */
export function notifyRejectedGenerationInputs(
  hooks: TtscTransformHooks | undefined,
  rejection: unknown,
): void {
  if (rejection instanceof TtscUnstableGenerationError) {
    notifyFailedGenerationInputs(hooks, rejection.validation.cached);
    return;
  }
  hooks?.addWatchFiles?.([], true);
}
