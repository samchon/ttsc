import path from "node:path";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { derivationIdentity } from "../envelope/derivationIdentity";
import { envelopeDerivation } from "../envelope/envelopeDerivation";
import { hostSpelling } from "../envelope/hostSpelling";
import { selectWatchInputs } from "../envelope/selectWatchInputs";
import { toProjectKey } from "../project/toProjectKey";
import { MISSING_INPUT_STATE } from "../validation/MISSING_INPUT_STATE";
import type { TtscTransformHooks } from "./TtscTransformHooks";
import type { TtscWatchInput } from "./TtscWatchInput";
import type { TtscWatchInputState } from "./TtscWatchInputState";
import type { TtscWatchSelection } from "./TtscWatchSelection";
import { handWatchInputs } from "./handWatchInputs";
import { projectMembershipInput } from "./projectMembershipInput";
import { selectionInputs } from "./selectionInputs";

/**
 * Forward every derived watch input for `file` to the adapter's `addWatchFile`
 * hook: the plugin-reported `dependencies[file]` list unioned with the
 * host-owned reference graph's contribution (`reach(edges, file)`, `globals`,
 * `configs`, and resolution candidates).
 *
 * Envelope keys mirror the `typescript` keys (project-relative); values may be
 * project-relative or absolute. Every path is absolutized against the project
 * root and deduplicated; the file itself is dropped (the bundler already
 * watches the module it transforms), and so is every path in the disposed
 * transform scratch tree (see
 * {@link TtscCachedProjectTransform.scratchDirectory}).
 */
export function notifyWatchInputs(
  hooks: TtscTransformHooks | undefined,
  cached: TtscCachedProjectTransform,
  file: string,
  selection: TtscWatchSelection,
): void {
  const addWatchFile = hooks?.addWatchFile;
  const addWatchFiles = hooks?.addWatchFiles;
  if (addWatchFile === undefined && addWatchFiles === undefined) {
    return;
  }
  const state = envelopeDerivation(cached);
  const spell = hostSpelling(
    { physical: state.projectPhysical, spelling: state.projectSpelling },
    file,
  );
  const external = cached.externalInputHashes ?? {};
  const inputs = selectWatchInputs({
    file,
    projectRoot: cached.projectRoot,
    result: cached.result,
    scratchDirectory: cached.scratchDirectory,
    temporaryTsconfig: cached.temporaryTsconfig,
  }).map((input): TtscWatchInput => {
    // Hand the adapter the identity this generation already resolved and the
    // exact state it already recorded. Both are memoized per generation, while
    // an adapter deriving them itself pays repeated filesystem reads and can
    // accidentally attach a later state to an earlier transform.
    const identity = derivationIdentity(state, input);
    const spelling = path.resolve(input);
    const observation = cached.externalInputObservations?.[spelling];
    const missing =
      observation?.fileExists === false ||
      state.graph?.inputProofs.get(spelling)?.hash === null ||
      external[identity] === MISSING_INPUT_STATE;
    const projectKey = toProjectKey(
      cached.projectRoot,
      input,
      state.identityContext,
    );
    const externalHash = Object.prototype.hasOwnProperty.call(
      external,
      identity,
    )
      ? external[identity]
      : undefined;
    const projectHash = Object.prototype.hasOwnProperty.call(
      cached.inputHashes,
      projectKey,
    )
      ? cached.inputHashes[projectKey]
      : undefined;
    const graphRealpaths = cached.externalInputRealpaths ?? {};
    const stateEvidence: TtscWatchInputState | undefined =
      observation !== undefined
        ? { codec: "predicates", observation }
        : externalHash !== undefined &&
            Object.prototype.hasOwnProperty.call(graphRealpaths, identity)
          ? {
              codec: "graph",
              hash: externalHash,
              realpath: graphRealpaths[identity] ?? null,
            }
          : externalHash !== undefined
            ? { codec: "host", hash: externalHash }
            : projectHash !== undefined
              ? { codec: "host", hash: projectHash }
              : undefined;
    return {
      // The host is handed its own spelling; every lookup above was by the
      // compiler's physical one.
      file: spell(input),
      evidence: {
        identity,
        missing,
        ...(stateEvidence === undefined ? {} : { state: stateEvidence }),
        unavailable:
          observation?.fileExists === false
            ? "not-file"
            : missing
              ? "missing"
              : undefined,
      },
    };
  });
  // The root files are the adapter's own decision rather than a compiler
  // input, so a host that asked for them gets them beside the derived ones.
  const membership =
    hooks?.membership === true ? projectMembershipInput(cached) : undefined;
  if (membership !== undefined) inputs.push(membership);
  inputs.push(
    ...selectionInputs(selection.consulted, selection.filesystem, spell),
  );
  handWatchInputs(hooks, inputs);
}
