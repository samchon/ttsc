import path from "node:path";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { resultFilesystem } from "../cache/resultFilesystem";
import { derivationIdentity } from "../envelope/derivationIdentity";
import { envelopeDerivation } from "../envelope/envelopeDerivation";
import { graphInputStateHash } from "../inputs/graphInputStateHash";
import { hostInputRealpath } from "../inputs/hostInputRealpath";
import { hostInputStateHash } from "../inputs/hostInputStateHash";
import { matchesGraphInputObservation } from "../inputs/matchesGraphInputObservation";
import { sameHostInputRealpath } from "../inputs/sameHostInputRealpath";
import { toProjectKey } from "../project/toProjectKey";
import { MISSING_INPUT_STATE } from "./MISSING_INPUT_STATE";

/** Compare one derived input with the snapshot that owned it at generation. */
export function matchesRecordedInput(
  cached: TtscCachedProjectTransform,
  input: string,
): boolean {
  const state = envelopeDerivation(cached);
  const filesystem = resultFilesystem(cached.result);
  const projectKey = toProjectKey(
    cached.projectRoot,
    input,
    state.identityContext,
  );
  const projectHash = Object.prototype.hasOwnProperty.call(
    cached.inputHashes,
    projectKey,
  )
    ? cached.inputHashes[projectKey]
    : undefined;
  const identity = derivationIdentity(state, input);
  const observation = cached.externalInputObservations?.[path.resolve(input)];
  if (observation !== undefined) {
    return matchesGraphInputObservation(
      input,
      observation,
      filesystem,
      state.identityContext,
    );
  }
  const externalHash = (cached.externalInputHashes ?? {})[identity];
  const externalRealpaths = cached.externalInputRealpaths;
  const graphInput =
    externalRealpaths !== undefined &&
    Object.prototype.hasOwnProperty.call(externalRealpaths, identity);
  if (
    externalRealpaths !== undefined &&
    Object.prototype.hasOwnProperty.call(externalRealpaths, identity) &&
    !sameHostInputRealpath(
      externalRealpaths[identity],
      hostInputRealpath(input, filesystem),
      state.identityContext,
    )
  ) {
    return false;
  }
  // Prefer the out-of-walk spelling's own snapshot when it exists. A lexical
  // alias can point back into the walked project, where the physical target's
  // project hash is a different authority (and graph text uses BOM decoding).
  const recorded = externalHash ?? projectHash;
  if (recorded === undefined) {
    return false;
  }
  try {
    const current = graphInput
      ? graphInputStateHash(input, filesystem)
      : hostInputStateHash(input, filesystem);
    return recorded === (current ?? MISSING_INPUT_STATE);
  } catch {
    return recorded === MISSING_INPUT_STATE;
  }
}
