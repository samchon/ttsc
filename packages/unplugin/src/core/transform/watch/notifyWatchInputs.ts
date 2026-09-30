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
 *
 * @evidence contracts/common.md#principled-implementation Module delivery derives the selected file's dependency set, while project delivery records the full generation plus each module's consulted routing configs; membership remains an explicitly requested additional input.
 * @evidence contracts/common.md#clear-and-simple-design Both host models share one routing observation batch, with dependency selection, evidence mapping and record persistence delegated to their actual owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Disposed scratch paths are removed by derivation and a missing project record marks output volatile instead of pretending module bytes cover type-only changes.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish module and project dependencies, scratch exclusion and routing, followed by separated tags under documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation Generation-owned identity and hostSpelling keep native physical identity separate from adapter spelling; routing observations use the delivery's filesystem capability.
 * @evidence contracts/performance.md#efficient-algorithms Derivation visits the selected dependency population and maps one carrier per input; selection config hashes are captured once and their evidence shared between record and module delivery.
 * @evidence contracts/performance.md#reuse-equivalent-work Generation-wide inputs and membership reuse their weak-keyed snapshots; actual per-module callback effects still run for every delivery and newly consulted configs extend the record snapshot.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This orchestrator owns call-local batches; generation snapshots, persistent records and watchers have separate retention owners.
 */
export function notifyWatchInputs(
  hooks: TtscTransformHooks | undefined,
  cached: TtscCachedProjectTransform,
  file: string,
  selection: TtscWatchSelection,
): void {
  if (
    hooks === undefined ||
    (hooks.project === undefined &&
      hooks.addWatchFile === undefined &&
      hooks.addWatchFiles === undefined)
  ) {
    return;
  }
  const state = envelopeDerivation(cached);
  const routedInputs = selectionInputs(
    selection.consulted,
    selection.filesystem,
    (input) => input,
  );
  // A module handed over without its record depends on its own bytes alone,
  // so no persistent cache may keep it.
  if (
    hooks.project !== undefined &&
    !notifyProjectRecord(
      hooks.project,
      cached,
      false,
      () => generationWatchInputs(cached),
      routedInputs,
    )
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
  for (const entryToAppend of routedInputs.map((input) => ({ ...input, file: spell(input.file) }))) inputs.push(entryToAppend);
  handWatchInputs(hooks, inputs);
}
