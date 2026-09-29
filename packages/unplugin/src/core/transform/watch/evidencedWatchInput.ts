import path from "node:path";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import type { TtscEnvelopeDerivation } from "../envelope/TtscEnvelopeDerivation";
import { derivationIdentity } from "../envelope/derivationIdentity";
import { selectPluginSourceInputs } from "../envelope/selectPluginSourceInputs";
import { toProjectKey } from "../project/toProjectKey";
import { MISSING_INPUT_STATE } from "../validation/MISSING_INPUT_STATE";
import type { TtscWatchInput } from "./TtscWatchInput";
import type { TtscWatchInputState } from "./TtscWatchInputState";

/**
 * One compiler input as a watch input, carrying the identity the generation
 * already resolved and the exact state it already recorded for the path: the
 * compiler's predicate observation where it made one, the graph's hash and
 * realpath for a realized input, the host bytes' hash for a walk or
 * dependency-only input, or the state of a plugin source directory.
 *
 * Both are memoized per generation, while a host deriving them itself pays
 * repeated filesystem reads and can attach a later state to an earlier
 * transform. An input the generation recorded no state for comes back with
 * `state` absent, and the caller decides what to read for it.
 *
 * @param spell The spelling the host is handed; every lookup is by the
 *   compiler's physical one.
 *
 * @evidence contracts/common.md#principled-implementation Generation observations select predicate, tree, graph or host state in provenance order, keeping physical target and availability distinct from the host's registration spelling.
 * @evidence contracts/common.md#clear-and-simple-design One derivation maps retained generation facts into the documented watch carrier while the caller supplies its spelling policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown codec state stays absent; the missing marker is a supported observation value rather than a guessed content hash.
 * @evidence contracts/common.md#meaningful-documentation Native prose describes generation evidence and spelling ownership, followed by separated acknowledgment tags under documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation Native path.resolve and the generation's identity context preserve actual filesystem identity separately from caller-selected lexical spelling.
 * @evidence contracts/performance.md#efficient-algorithms Map and property lookups derive one carrier without rereading file contents; path work depends on spelling length and identity lookup delegates to the shared context.
 * @evidence contracts/performance.md#reuse-equivalent-work Hashes, predicate observations and identity derivation are shared from the cached generation, whose recorded input facts are immutable for delivery.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This mapping stores no new persistent cache or handle; retained generation facts belong to the generation owner.
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
  // A plugin's source directory is proven by the state its binary was built
  // from, whatever else observed the path (samchon/ttsc#1487).
  const digest = selectPluginSourceInputs(cached.result).get(spelling);
  if (digest !== undefined) {
    return {
      file: spell(input),
      evidence: {
        identity,
        missing: false,
        state: { codec: "tree", digest },
      },
    };
  }
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
