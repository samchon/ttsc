import path from "node:path";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import type { TtscEnvelopeDerivation } from "../envelope/TtscEnvelopeDerivation";
import { derivationIdentity } from "../envelope/derivationIdentity";
import { toProjectKey } from "../project/toProjectKey";

/**
 * Locate the signature manifest that owns one recorded input, mirroring
 * `matchesRecordedInput`'s own preference for the out-of-walk spelling's
 * snapshot over the walked project's.
 *
 * The manifest is returned whether or not it currently holds a signature for
 * the input, so a content comparison that succeeds can record one. Without
 * that, an input whose capture-time metadata was too recent to prove anything
 * would keep its content read for the whole life of the generation, since
 * nothing else ever revisits it. Returns undefined for predicate-bearing inputs
 * or inputs without a recorded scalar hash: neither has a scalar signature slot
 * to update.
 *
 * @evidence contracts/common.md#principled-implementation Predicate observations have no scalar slot; external spelling snapshots take precedence over project hashes and separate physical content keys from lexical metadata keys.
 * @evidence contracts/common.md#clear-and-simple-design One lookup exposes the actual owning signature manifest so validators update its proof without duplicating precedence.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An input without a recorded hash cannot acquire a metadata substitute through an invented slot.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain precedence, lazy signature admission and the exact undefined condition before tags.
 * @evidence contracts/portability.md#os-neutral-implementation Native lexical resolution supplies metadata spelling while derivationIdentity and toProjectKey apply the generation's actual filesystem identity context.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   No loop or traversal of its own; constant work apart from delegated
 *   calls.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   Hands back the existing signature record on the cached transform instead
 *   of rebuilding it.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Retains signature records on the cached transform, bounded by the
 *   declared inputs, and releases them with it.
 */
export function inputSignatureSlot(
  cached: TtscCachedProjectTransform,
  state: TtscEnvelopeDerivation,
  input: string,
):
  | {
      /** Metadata key in the actual owning signature manifest. */
      key: string;

      /** Authoritative scalar content or missing-state value. */
      recorded: string;

      /** Generation-owned signature manifest updated after qualified reads. */
      signatures: Record<string, string>;
    }
  | undefined {
  const identity = derivationIdentity(state, input);
  if (cached.externalInputObservations?.[path.resolve(input)] !== undefined) {
    return undefined;
  }
  const external = cached.externalInputHashes ?? {};
  if (Object.prototype.hasOwnProperty.call(external, identity)) {
    // The recorded hash is identity-keyed because aliases of one physical file
    // share its content; the signature is spelling-keyed because they do not
    // share its metadata.
    return {
      key: path.resolve(input),
      recorded: external[identity]!,
      signatures: (cached.externalInputSignatures ??= {}),
    };
  }
  const projectKey = toProjectKey(
    cached.projectRoot,
    input,
    state.identityContext,
  );
  return Object.prototype.hasOwnProperty.call(cached.inputHashes, projectKey)
    ? {
        key: projectKey,
        recorded: cached.inputHashes[projectKey]!,
        signatures: (cached.inputSignatures ??= {}),
      }
    : undefined;
}
