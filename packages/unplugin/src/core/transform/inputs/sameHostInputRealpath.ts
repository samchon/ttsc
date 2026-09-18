import type { FilesystemPathIdentityContext } from "ttsc/path-identity";

import { pathIdentityKey } from "../filesystem/pathIdentityKey";

/** Compare two reported realpaths by filesystem identity, not Windows spelling. */
export function sameHostInputRealpath(
  left: string | null | undefined,
  right: string | null,
  identities: FilesystemPathIdentityContext,
): boolean {
  if (left === undefined || (left === null) !== (right === null)) return false;
  if (left === null || right === null) return true;
  return (
    pathIdentityKey(left, identities) === pathIdentityKey(right, identities)
  );
}
