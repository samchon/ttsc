import path from "node:path";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { resultFilesystem } from "../cache/resultFilesystem";
import { envelopeDerivation } from "../envelope/envelopeDerivation";
import { pathIdentityKey } from "../filesystem/pathIdentityKey";
import { hostInputStateHash } from "../inputs/hostInputStateHash";

/** Capture source baselines for project and out-of-walk transform outputs. */
export function captureTransformSourceHashes(
  cached: TtscCachedProjectTransform,
  currentFile: string,
  currentSourceHash: string,
): Record<string, string> {
  const filesystem = resultFilesystem(cached.result);
  const identities = envelopeDerivation(cached).identityContext;
  const hashes: Record<string, string> = {};
  if (cached.result.type === "success") {
    for (const output of Object.keys(cached.result.typescript)) {
      const file = path.resolve(cached.projectRoot, output);
      const hash = hostInputStateHash(file, filesystem);
      if (hash !== null) hashes[pathIdentityKey(file, identities)] = hash;
    }
  }
  hashes[pathIdentityKey(currentFile, identities)] = currentSourceHash;
  return hashes;
}
