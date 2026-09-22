import path from "node:path";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import type { TtscEnvelopeDerivation } from "../envelope/TtscEnvelopeDerivation";
import { derivationIdentity } from "../envelope/derivationIdentity";
import { toProjectKey } from "../project/toProjectKey";
import { MISSING_INPUT_STATE } from "../validation/MISSING_INPUT_STATE";
import type { TtscWatchInput } from "./TtscWatchInput";
import type { TtscWatchInputState } from "./TtscWatchInputState";

/**
 * One compiler input as a watch input, carrying the identity the generation
 * already resolved and the exact state it already recorded for the path: the
 * compiler's predicate observation where it made one, the graph's hash and
 * realpath for a realized input, or the host bytes' hash for a walk or
 * dependency-only input.
 *
 * Both are memoized per generation, while a host deriving them itself pays
 * repeated filesystem reads and can attach a later state to an earlier
 * transform. An input the generation recorded no state for comes back with
 * `state` absent, and the caller decides what to read for it.
 *
 * @param spell The spelling the host is handed; every lookup is by the
 *   compiler's physical one.
 */
export function evidencedWatchInput(
  cached: TtscCachedProjectTransform,
  state: TtscEnvelopeDerivation,
  input: string,
  spell: (input: string) => string,
): TtscWatchInput {
  const external = cached.externalInputHashes ?? {};
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
  const externalHash = Object.prototype.hasOwnProperty.call(external, identity)
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
}
