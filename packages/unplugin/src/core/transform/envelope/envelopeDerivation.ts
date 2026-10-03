import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

import { resultFilesystem } from "../cache/resultFilesystem";
import { createHostPathIdentityContext } from "../filesystem/createHostPathIdentityContext";
import type { TtscEnvelopeDerivation } from "./TtscEnvelopeDerivation";

/**
 * Derivation states keyed by the compiler result object. One result object is
 * produced by one compile against one project root, so the root captured at
 * build time is the only root the state ever sees.
 */
const ENVELOPE_DERIVATIONS = new WeakMap<
  ITtscCompilerTransformation,
  TtscEnvelopeDerivation
>();

/**
 * Return the derivation state of `props.result`, building it on first use.
 *
 * A result object belongs to one immutable generation and one project root.
 * The same object must not be repurposed for a different root or mutated input
 * metadata, because object identity is the state reuse key.
 *
 * @evidence contracts/common.md#principled-implementation Result object identity denotes one compiler generation; resolving its root once establishes physical and lexical spellings for every index using the same filesystem context.
 * @evidence contracts/common.md#clear-and-simple-design This function owns the generation-to-state association and initial root/context; individual selectors lazily populate only their needed indexes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The weak association follows an actual generation boundary, with an explicit immutable-result/root premise rather than comparing selected output text to pretend generations are equivalent.
 * @evidence contracts/common.md#meaningful-documentation Native prose states first-use construction and the one-result/one-root immutability premise that controls safe reuse; paragraph and tag separation follow the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native path.resolve determines root spelling and createHostPathIdentityContext uses the result's filesystem capabilities to obtain its physical root without OS-name case guesses.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Weak keys do not keep discarded result objects alive, but callers may retain returned state. Identity/ancestor memos, per-spelling watch lists and lazy graph/output/dependency/selection indexes grow with queries and that generation's producer populations, without a separate eviction or byte cap. They become collectible when neither the generation nor a caller retains them; this owner acquires no persistent native handle.
 * @evidence contracts/performance.md#efficient-algorithms Existing states require fixed WeakMap entry access. Cold state allocates empty tables and resolves root path text through native identity/ancestor/case observations, without eagerly scanning graph/dependency records. One root request does not imply one constant-cost native operation.
 * @evidence contracts/performance.md#reuse-equivalent-work All requests carrying the same immutable compiler result share one state; a fresh result object starts a fresh context and indexes, and one object cannot safely serve another root.
 */
export function envelopeDerivation(props: {
  projectRoot: string;
  result: ITtscCompilerTransformation;
}): TtscEnvelopeDerivation {
  const existing = ENVELOPE_DERIVATIONS.get(props.result);
  if (existing !== undefined) {
    return existing;
  }
  const identityContext = createHostPathIdentityContext(
    resultFilesystem(props.result),
  );
  const spelling = path.resolve(props.projectRoot);
  const created: TtscEnvelopeDerivation = {
    identityContext,
    identities: new Map(),
    project: {
      physical: identityContext.resolve(spelling).path,
      spelling,
    },
    watchInputs: new Map(),
  };
  ENVELOPE_DERIVATIONS.set(props.result, created);
  return created;
}
