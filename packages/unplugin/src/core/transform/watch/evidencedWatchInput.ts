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
 * One input as a watch input, carrying identity from the generation's qualified
 * native context and the state it recorded for the path: the
 * compiler's predicate observation where it made one, the graph's hash and
 * realpath for a realized input, the host bytes' hash for a walk or
 * dependency-only input, or the state of a plugin source directory.
 *
 * State payloads are retained generation observations; identity queries share
 * the generation context but a first spelling can still require native reads.
 * A plugin source state takes precedence over other recorded codecs. An input
 * with no recorded state returns `state` absent, leaving its caller to decide
 * whether another observation is appropriate. No current byte read here
 * manufactures evaluation-time state.
 *
 * @param spell The registration spelling callback. Predicate lookup uses the
 *   native absolute lexical input; hash dictionaries use physical identity or
 *   project keys without discarding the predicate's original spelling.
 *
 * @evidence contracts/common.md#principled-implementation Recorded plugin tree state takes precedence, then exact lexical predicates, external graph/host state and project host bytes. Own-entry hash guards preserve absent baselines; unknown state stays absent, with physical target/availability separate from registration spelling.
 * @evidence contracts/common.md#clear-and-simple-design One derivation maps retained generation facts into the documented watch carrier while the caller supplies its spelling policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown codec state stays absent; the missing marker is a supported observation value rather than a guessed content hash.
 * @evidence contracts/common.md#meaningful-documentation Native prose describes generation evidence and spelling ownership, followed by separated acknowledgment tags under documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation Native path.resolve and the generation's identity context preserve actual filesystem identity separately from caller-selected lexical spelling.
 * @evidence contracts/performance.md#efficient-algorithms Each call allocates one carrier and performs lexical/identity queries plus a plugin-source lookup; a first plugin lookup may parse the full declared source record. Non-tree inputs also compute the project key before selecting the recorded codec. Cost includes key/path text, any cold native path/ancestor/case observations and one caller spelling callback, while recorded byte hashes are not reread. Shared context/plugin populations remain owner costs beyond this fixed carrier allocation.
 * @evidence contracts/performance.md#reuse-equivalent-work Recorded hashes/predicates and plugin state come from one immutable generation. Identity and project-key queries share its context under a still-valid native view and fixed root; this operation creates a fresh carrier rather than memoizing it, and cannot certify those premises independently.
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
