import path from "node:path";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { resultFilesystem } from "../cache/resultFilesystem";
import { envelopeDerivation } from "../envelope/envelopeDerivation";
import { pathIdentityKey } from "../filesystem/pathIdentityKey";
import { hostInputStateHash } from "../inputs/hostInputStateHash";

/**
 * Capture on-disk source baselines for emitted project and out-of-walk outputs.
 * The requested source receives the caller's already captured hash, including
 * when no output manifest exposes it. Unreadable other sources remain absent.
 *
 * @evidence contracts/common.md#principled-implementation Successful output keys identify source paths relative to the project, native content hashes become identity-keyed baselines and the caller's current-source observation overrides that same identity consistently.
 * @evidence contracts/common.md#clear-and-simple-design This helper constructs only the source baseline map; resultFilesystem supplies native reads and envelopeDerivation supplies the generation's shared identity context.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing source reads do not become invented hashes or transform-text baselines; the current hash comes from the capture caller's selected disk/delivery observation.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain source rather than emitted-text hashing, current-source inclusion and unreadable-source absence before tags.
 * @evidence contracts/portability.md#os-neutral-implementation Output paths are resolved with Node native semantics and compared through the envelope identity context; no case folding or OS-specific file reader is introduced.
 * @evidence contracts/performance.md#efficient-algorithms One output-key pass hashes each exposed source and inserts its key; the current source reuses the supplied hash instead of another read.
 * @evidence contracts/performance.md#reuse-equivalent-work The caller's current hash and envelope identity context are reused, while the fresh map belongs to this capture rather than being reused across changed file content.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Generation capture owns the returned baseline map's lifetime; this helper acquires no retained handle or observer.
 */
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
