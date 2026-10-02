import path from "node:path";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { resultFilesystem } from "../cache/resultFilesystem";
import { envelopeDerivation } from "../envelope/envelopeDerivation";
import { pathIdentityKey } from "../filesystem/pathIdentityKey";
import { hostInputStateHash } from "../inputs/hostInputStateHash";

/**
 * Capture native host-state hashes for source paths named by transform outputs,
 * including sources outside the project walk. Reads hash raw bytes; a failed
 * read of an observed directory retains the host-state directory marker, while
 * other unreadable output paths remain absent.
 *
 * The current source identity is then overwritten with the caller's selected
 * hash even when no output names it. Capture supplies its pre-compile disk hash
 * when available and otherwise the delivered-text hash; that fallback does not
 * establish that the compiler observed those bytes. If the output pass already
 * read this source, the final assignment does not undo that read.
 *
 * @evidence contracts/common.md#principled-implementation Successful output keys identify source paths relative to the project; native host-state hashes become identity-keyed baselines and the caller's selected disk-or-delivery hash overrides the current identity without granting generation completeness.
 * @evidence contracts/common.md#clear-and-simple-design This helper constructs only the source baseline map; resultFilesystem supplies native reads and envelopeDerivation supplies the generation's shared identity context.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Non-directory failed reads supply no fabricated output-source hash, and transformed output text is never hashed as source. The explicitly supplied current-source fallback is distinguished from native disk evidence; the capture owner separately decides completeness and reuse.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish raw host state, directory markers and failed reads from the current source's caller-selected fallback and explain the output-pass read that an override cannot avoid.
 * @evidence contracts/portability.md#os-neutral-implementation Output paths are resolved with Node native semantics and compared through the envelope identity context; no case folding or OS-specific file reader is introduced.
 * @evidence contracts/performance.md#efficient-algorithms Object.keys allocates the full output-key array, then one pass resolves native spellings, reads and hashes each exposed source's bytes and inserts successful host states. Failed reads may stat; identity resolution may observe uncached ancestors and case capabilities. Distinct output spellings may repeat a physical read before sharing one key. Map storage grows with distinct identities and key text; the final current assignment adds no read beyond that pass.
 * @evidence contracts/performance.md#reuse-equivalent-work The caller's selected current hash and the immutable envelope's identity transaction are reused; the output pass does not memoize content reads by physical identity. The fresh map belongs to this capture rather than reusing historical content across changes.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Generation capture owns the returned baseline map's lifetime; this helper acquires no retained handle or observer.
 */
export function captureTransformSourceHashes(
  /** Generation supplying native reads, output names and shared identity. */
  cached: TtscCachedProjectTransform,
  /** Requested native source spelling, included even without an output key. */
  currentFile: string,
  /** Caller-selected pre-compile disk hash or delivered-text fallback. */
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
