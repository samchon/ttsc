import path from "node:path";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import type { TtscEnvelopeDerivation } from "../envelope/TtscEnvelopeDerivation";
import { derivationIdentity } from "../envelope/derivationIdentity";
import { toProjectKey } from "../project/toProjectKey";

/**
 * Locate the signature manifest that owns one recorded input, mirroring
 * {@link matchesRecordedInput}'s own preference for the out-of-walk spelling's
 * snapshot over the walked project's.
 *
 * The manifest is returned whether or not it currently holds a signature for
 * the input, so a content comparison that succeeds can record one. Without
 * that, an input whose capture-time metadata was too recent to prove anything
 * would keep its content read for the whole life of the generation, since
 * nothing else ever revisits it. Returns `undefined` only for an input the
 * generation recorded no hash for, which no signature could stand for.
 */
export function inputSignatureSlot(
  cached: TtscCachedProjectTransform,
  state: TtscEnvelopeDerivation,
  input: string,
):
  | { key: string; recorded: string; signatures: Record<string, string> }
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
