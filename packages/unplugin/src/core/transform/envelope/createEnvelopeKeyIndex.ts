import path from "node:path";

import type { TtscEnvelopeDerivation } from "./TtscEnvelopeDerivation";
import { derivationIdentity } from "./derivationIdentity";

/**
 * Build a first-match identity index over one envelope key map (`typescript`,
 * `dependencies`), mirroring the historical per-delivery scan that returned the
 * first entry whose resolved key matched by filesystem identity.
 */
export function createEnvelopeKeyIndex<T>(
  state: TtscEnvelopeDerivation,
  projectRoot: string,
  keyed: Record<string, T>,
): Map<string, T> {
  const index = new Map<string, T>();
  for (const [candidate, value] of Object.entries(keyed)) {
    const identity = derivationIdentity(
      state,
      path.resolve(projectRoot, candidate),
    );
    if (!index.has(identity)) {
      index.set(identity, value);
    }
  }
  return index;
}
