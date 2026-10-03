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

/**
 * Compare one derived input with the snapshot that owned it at generation.
 *
 * Rich predicates take precedence. Legacy graph content uses the compiler text
 * codec and physical-target proof; ordinary host inputs use raw content state.
 * An unrecorded input supplies no reuse authority.
 *
 * @evidence contracts/common.md#principled-implementation Predicate, graph-text and host-byte snapshots retain their distinct meanings; external spelling authority takes precedence over a physical target's walked-project hash.
 * @evidence contracts/common.md#clear-and-simple-design One recorded-state comparison owns precedence and codec selection, shared by complete and narrow validators.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A missing snapshot is not replaced by a current hash; byte equality cannot override a recorded graph realpath mismatch.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain predicate precedence, legacy graph codec, host state and absence of authority before tags.
 * @evidence contracts/portability.md#os-neutral-implementation Generation identity keys and native filesystem operations distinguish lexical aliases, compiler text semantics and actual case policy across hosts.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The comparison borrows snapshots and retains no result history or native resource.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Fixed manifest probes follow project/native identity resolution, whose
 *   uncached work includes ancestor/case observations and path text. Predicate
 *   replay collects its failures and may read bytes or enumerate entries;
 *   legacy graph inputs additionally prove recorded realpath before decoding
 *   and hashing text. Host inputs hash raw bytes with kind fallback after a
 *   failed read. No branch enumerates the whole project here.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work matchesProvenInput and complete admission decide when this comparison can be shared or omitted; this primitive establishes one requested verdict.
 */
export function matchesRecordedInput(
  /** Generation owning the distinct predicate, graph-text and host-byte snapshots. */
  cached: TtscCachedProjectTransform,
  /** Native spelling replayed against its owning recorded authority. */
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
