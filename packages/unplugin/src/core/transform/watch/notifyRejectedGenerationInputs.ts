import fs from "node:fs";
import path from "node:path";

import { projectRecordFile } from "../../bridge/projectRecordFile";
import { hostSpelling } from "../envelope/hostSpelling";
import { TtscUnstableGenerationError } from "../errors/TtscUnstableGenerationError";
import { createHostPathIdentityContext } from "../filesystem/createHostPathIdentityContext";
import type { TtscTransformHooks } from "./TtscTransformHooks";
import type { TtscWatchSelection } from "./TtscWatchSelection";
import { handWatchInputs } from "./handWatchInputs";
import { notifyFailedGenerationInputs } from "./notifyFailedGenerationInputs";
import { selectionInputs } from "./selectionInputs";

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
 *
 * @param file The delivered module, as the host spelled it.
 * @param selection The configs that routed the file to its project, and the
 *   project's tsconfig, which spells the project for a rejection that has no
 *   generation to spell it.
 *
 * @evidence contracts/common.md#principled-implementation An unstable attempt exposes its retained validation generation through normal failed delivery; a rejection without a generation can register only its known selection dependencies and an existing project record.
 * @evidence contracts/common.md#clear-and-simple-design The unstable branch delegates generation recovery, while the generation-free branch has one routing batch shared by record and module callbacks.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown compiler inputs are not invented; absent records mark the module volatile and registration honestly has no newly written digest.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish rejection categories and limited recovery coverage, with documented parameters and separated tags following documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation The delivery's filesystem supplies project physical identity, native path operations provide spelling and actual record existence selects only a host-approved directory.
 * @evidence contracts/performance.md#efficient-algorithms The generation-free path maps O(S) routing configs and probes at most two approved record locations; unstable recovery delegates its retained-input traversal.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Recovery registration is a delivery effect and rejection without a generation offers no equivalent completed compiler computation to cache here.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The recovery batch and record candidate list are local; host watchers own any retained dependencies after callbacks return.
 */
export function notifyRejectedGenerationInputs(
  hooks: TtscTransformHooks | undefined,
  rejection: unknown,
  file: string,
  selection: TtscWatchSelection,
): void {
  if (rejection instanceof TtscUnstableGenerationError) {
    notifyFailedGenerationInputs(
      hooks,
      rejection.validation.cached,
      file,
      selection,
    );
    return;
  }
  if (hooks === undefined) return;
  const spelling = path.dirname(selection.tsconfig);
  const spell = hostSpelling(
    {
      physical: createHostPathIdentityContext(selection.filesystem).resolve(
        spelling,
      ).path,
      spelling,
    },
    file,
  );
  const inputs = selectionInputs(
    selection.consulted,
    selection.filesystem,
    spell,
  );
  // A generation the adapter rejected has no state to record beyond the
  // config selection it read: a build host keeps the record its last
  // generation wrote, which its bridge moves when the selection changes. A
  // record no generation wrote is not handed over, as `notifyProjectRecord`
  // hands over none that is not there, and the module is marked uncacheable
  // as one that function could not hand its record to is.
  if (hooks.project !== undefined) {
    // Below the host's tool directory, or the fallback it accepts, where the
    // last generation may have written it (samchon/ttsc#1480).
    const record = [
      hooks.project.toolDirectory,
      ...(hooks.project.fallbackToolDirectory === undefined
        ? []
        : [hooks.project.fallbackToolDirectory]),
    ]
      .map((directory) => projectRecordFile(directory, selection.tsconfig))
      .find((candidate) => fs.existsSync(candidate));
    if (record !== undefined) {
      hooks.project.register({ failed: true, inputs: () => inputs, record });
    } else {
      hooks.markVolatile?.();
    }
  }
  if (hooks.addWatchFile === undefined && hooks.addWatchFiles === undefined) {
    return;
  }
  handWatchInputs(hooks, inputs, true);
}
