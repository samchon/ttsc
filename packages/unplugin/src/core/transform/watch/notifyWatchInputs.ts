import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { envelopeDerivation } from "../envelope/envelopeDerivation";
import { hostSpelling } from "../envelope/hostSpelling";
import { selectWatchInputs } from "../envelope/selectWatchInputs";
import type { TtscTransformHooks } from "./TtscTransformHooks";
import type { TtscWatchInput } from "./TtscWatchInput";
import type { TtscWatchSelection } from "./TtscWatchSelection";
import { evidencedWatchInput } from "./evidencedWatchInput";
import { generationWatchInputs } from "./generationWatchInputs";
import { handWatchInputs } from "./handWatchInputs";
import { notifyProjectRecord } from "./notifyProjectRecord";
import { projectMembershipInput } from "./projectMembershipInput";
import { selectionInputs } from "./selectionInputs";

/**
 * Hand the host what a successful delivery of `file` depends on.
 *
 * A host keyed on the module's own inputs (`addWatchFile`, `addWatchFiles`)
 * receives the inputs derived for `file`: the plugin-reported
 * `dependencies[file]` list unioned with the host-owned reference graph's
 * contribution (`reach(edges, file)`, `globals`, `configs`, and resolution
 * candidates), each with the evidence the generation recorded, plus the config
 * selection. Envelope keys mirror the `typescript` keys (project-relative);
 * values may be project-relative or absolute. Every path is absolutized against
 * the project root and deduplicated; the file itself is dropped (the host
 * already watches the module it transforms), and so is every path in the
 * disposed transform scratch tree (see
 * {@link TtscCachedProjectTransform.scratchDirectory}).
 *
 * A build host (`project`) receives the project's record instead, written to
 * the generation's state from every input of the generation
 * (`notifyProjectRecord`).
 */
export function notifyWatchInputs(
  hooks: TtscTransformHooks | undefined,
  cached: TtscCachedProjectTransform,
  file: string,
  selection: TtscWatchSelection,
): void {
  if (hooks === undefined) return;
  const state = envelopeDerivation(cached);
  // A module handed over without its record depends on its own bytes alone,
  // so no persistent cache may keep it.
  if (
    hooks.project !== undefined &&
    !notifyProjectRecord(hooks.project, cached, false, () => [
      ...generationWatchInputs(cached),
      ...selectionInputs(
        selection.consulted,
        selection.filesystem,
        (input) => input,
      ),
    ])
  ) {
    hooks.markVolatile?.();
  }
  if (hooks.addWatchFile === undefined && hooks.addWatchFiles === undefined) {
    return;
  }
  const spell = hostSpelling(state.project, file);
  const inputs: TtscWatchInput[] = selectWatchInputs({
    file,
    projectRoot: cached.projectRoot,
    result: cached.result,
    scratchDirectory: cached.scratchDirectory,
    temporaryTsconfig: cached.temporaryTsconfig,
  }).map((input) => evidencedWatchInput(cached, state, input, spell));
  // The root files are the adapter's own decision rather than a compiler
  // input, so a host that asked for them gets them beside the derived ones.
  const membership =
    hooks.membership === true ? projectMembershipInput(cached) : undefined;
  if (membership !== undefined) inputs.push(membership);
  inputs.push(
    ...selectionInputs(selection.consulted, selection.filesystem, spell),
  );
  handWatchInputs(hooks, inputs);
}
