import { pathIdentityKey } from "../filesystem/pathIdentityKey";
import type { TtscEnvelopeDerivation } from "./TtscEnvelopeDerivation";

/**
 * {@link pathIdentityKey} memoized inside one envelope's derivation state.
 * Callers always pass already-resolved absolute paths, so the input string is a
 * stable memo key.
 */
export function derivationIdentity(
  state: TtscEnvelopeDerivation,
  file: string,
): string {
  const existing = state.identities.get(file);
  if (existing !== undefined) {
    return existing;
  }
  const identity = pathIdentityKey(file, state.identityContext);
  state.identities.set(file, identity);
  return identity;
}
