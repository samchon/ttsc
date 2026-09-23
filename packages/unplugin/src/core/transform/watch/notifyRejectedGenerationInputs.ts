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
    const record = projectRecordFile(
      hooks.project.toolDirectory,
      selection.tsconfig,
    );
    if (fs.existsSync(record)) {
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
