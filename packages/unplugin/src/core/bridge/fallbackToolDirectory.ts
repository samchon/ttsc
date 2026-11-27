import crypto from "node:crypto";
import path from "node:path";

import { userStateDirectory } from "../transform/filesystem/userStateDirectory";

/**
 * Where a host's project records live when its own tool directory
 * (`hostToolDirectory`) cannot be written, or `undefined` when this user has no
 * such place either (samchon/ttsc#1480).
 *
 * A module handed to a build host without its project's record depends on its
 * own bytes alone: a watching session cannot tell the host that a type the
 * module's output consulted changed, and a persistent cache restores it
 * whatever its types did. A read-only checkout, a restricted sandbox, or a file
 * occupying an ignored cache path can leave the root unwritable, so the record
 * then lives below this user's own directory under the system temporary
 * directory (`userStateDirectory`), one directory per host root.
 *
 * The place is the same for a host root in every process, since a persistent
 * cache that recorded a record's path must find it at its next start, and the
 * build start's proof and a watching session's bridge look there as well as
 * below the root. It is spelled in its long form, which webpack and Rspack
 * require of a watched directory on Windows. A host that accepts no record
 * outside its root, Turbopack, or none it cannot relate to its root, Farm on
 * another drive, does not take it (`hostToolDirectory`).
 *
 * @param root The host's root, as `hostToolDirectory` names it.
 * @evidence contracts/common.md#principled-implementation
 *   A resolved-root digest gives each host a stable directory beneath the
 *   validated user state root; absence remains explicit when no safe root exists.
 * @evidence contracts/common.md#clear-and-simple-design
 *   This helper owns root-to-fallback naming while userStateDirectory owns
 *   directory trust and hosts decide whether outside-root dependencies are allowed.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The fallback handles actual unwritable roots using a product-owned user
 *   directory, not an arbitrary globally writable or fixture-specific location.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain stable paths, Windows long spelling and hosts
 *   that cannot accept the fallback, following documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation The validated user state boundary obtains a private native directory and long Windows spelling; native root resolution determines naming, while adapters separately reject fallback locations their host cannot watch.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Every call resolves and hashes the root's map key text. A cold name also
 *   obtains the native temporary-root realpath, recursive state-directory
 *   creation and directory-kind/available-uid checks, then hashes and joins
 *   the fallback spelling. A warm name avoids those delegated checks and the
 *   naming digest, not root resolution or map-key work.
 * @evidence contracts/performance.md#reuse-equivalent-work A resolved host root shares its stable fallback naming within the process; actual write capability is checked by writers rather than certified by the cached name, and an unavailable initial user root remains unavailable here.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The module map retains one optional naming result per distinct resolved root for the process lifetime, without an eviction bound; no native handle is retained, and record-directory persistence belongs to the host cache protocol.
 */
export function fallbackToolDirectory(root: string): string | undefined {
  const key = path.resolve(root);
  if (!FALLBACKS.has(key)) {
    // The provider checks directory kind and available uid/mode authority;
    // other platforms rely on native temporary-directory access policy.
    // The directories below are created by the first write.
    const state = userStateDirectory(undefined, key, false);
    const directory =
      state === undefined
        ? undefined
        : path.join(
            state,
            "hosts",
            crypto.createHash("sha256").update(key).digest("hex").slice(0, 32),
          );
    FALLBACKS.set(key, directory);
    if (directory !== undefined) GENERATED_DIRECTORIES.add(directory);
  }
  return FALLBACKS.get(key);
}

/** Each host root's fallback, established once per process. */
const FALLBACKS = new Map<string, string | undefined>();
const GENERATED_DIRECTORIES = new Set<string>();

/**
 * Whether this process named the path for an automatic record fallback.
 *
 * @evidence contracts/common.md#principled-implementation Tests exact membership in the set populated by automatic fallback naming.
 * @evidence contracts/common.md#clear-and-simple-design Naming owns provenance while record acquisition owns live directory qualification.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An explicit path with a matching basename pattern does not gain automatic provenance.
 * @evidence contracts/common.md#meaningful-documentation Identifies the naming owner and process lifetime.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Receives an already named path without native lookup.
 * @evidence contracts/performance.md#efficient-algorithms One set membership query over the path string.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The query reads naming state and performs no reusable computation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No state is retained by this query.
 */
export function isGeneratedFallbackToolDirectory(directory: string): boolean {
  return GENERATED_DIRECTORIES.has(directory);
}
