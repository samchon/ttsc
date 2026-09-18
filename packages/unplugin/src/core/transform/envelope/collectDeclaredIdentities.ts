import path from "node:path";

import type { TtscEnvelopeDerivation } from "./TtscEnvelopeDerivation";
import { derivationIdentity } from "./derivationIdentity";

/**
 * Fold one envelope member list (`volatile`, `dependenciesComplete`) into an
 * identity set. Members are keyed like `typescript`, so a project-relative and
 * an absolute spelling of the same file share one identity; a malformed member
 * is ignored rather than fatal.
 */
export function collectDeclaredIdentities(
  state: TtscEnvelopeDerivation,
  projectRoot: string,
  listed: unknown,
): Set<string> {
  const output = new Set<string>();
  if (!Array.isArray(listed)) {
    return output;
  }
  for (const entry of listed) {
    if (typeof entry !== "string" || entry.length === 0) {
      continue;
    }
    output.add(derivationIdentity(state, path.resolve(projectRoot, entry)));
  }
  return output;
}
