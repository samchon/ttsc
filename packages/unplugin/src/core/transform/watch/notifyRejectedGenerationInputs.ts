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
 * then registers its known selected config along with reported routing inputs.
 * An explicit project has no discovery history, but its config must still reach
 * recovery callbacks. These registrations provide a config-edit recovery
 * channel; they do not claim the unknown compiler input closure is complete.
 *
 * @param file The delivered module, as the host spelled it.
 * @param selection The configs that routed the file to its project, and the
 *   project's tsconfig, which spells the project for a rejection that has no
 *   generation to spell it.
 * @evidence contracts/common.md#principled-implementation An unstable attempt delegates its retained validation generation to normal failed delivery. A generation-free rejection registers the already-selected config as well as reported routing dependencies, including empty explicit-discovery history; current recovery facts do not manufacture compiler output or claim an unknown complete closure.
 * @evidence contracts/common.md#clear-and-simple-design The unstable branch delegates generation recovery, while the generation-free branch has one routing batch shared by record and module callbacks.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The selected config comes from actual project selection, not a guessed dependency. Existing project records gain no newly accepted digest; absent records request a supplied volatility callback rather than inventing persistence or guaranteeing a host cache effect.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish rejection categories and limited recovery coverage, with documented parameters and separated tags following documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation The delivery's filesystem supplies project physical identity, native path operations provide spelling and actual record existence selects only a host-approved directory.
 * @evidence contracts/performance.md#efficient-algorithms The generation-free path resolves the selected root's native identity, chooses host spelling, dedupes reported routing names plus the selected config and observes each retained spelling's current host state. Cost includes bytes, path/key text, cold native ancestor/case observations and callback work; optional native record lookup considers at most two approved addresses. Arrays/context entries and callback-transferred inputs follow these populations. Unstable recovery includes its delegated retained-path/diagnostic/record computation rather than fixed work.
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
  const consulted = [...new Set([...selection.consulted, selection.tsconfig])];
  const inputs = selectionInputs(consulted, selection.filesystem, spell);
  // A generation the adapter rejected has no state to record beyond the
  // known selected config and reported routing names: a build host keeps its last
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
