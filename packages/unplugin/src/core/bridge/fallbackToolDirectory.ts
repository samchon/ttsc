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
 * standing where `.ttsc` would be leaves the root unwritable, so the record
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
 *
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
 * @evidence contracts/performance.md#efficient-algorithms Root resolution and SHA-256 naming cost O(R) in root spelling length; a process map avoids repeated trust lookup and hashing for an already named root.
 * @evidence contracts/performance.md#reuse-equivalent-work A resolved host root shares its stable fallback naming within the process; actual write capability is checked by writers rather than certified by the cached name, and an unavailable initial user root remains unavailable here.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The module map retains one optional naming result per distinct resolved root for the process lifetime, without an eviction bound; no native handle is retained, and record-directory persistence belongs to the host cache protocol.
 */
export function fallbackToolDirectory(root: string): string | undefined {
  const key = path.resolve(root);
  if (!FALLBACKS.has(key)) {
    // The user's own root is checked, and nothing below it is reachable by
    // anyone else; the directories below are created by the first write.
    const state = userStateDirectory();
    FALLBACKS.set(
      key,
      state === undefined
        ? undefined
        : path.join(
            state,
            "hosts",
            crypto.createHash("sha256").update(key).digest("hex").slice(0, 32),
          ),
    );
  }
  return FALLBACKS.get(key);
}

/** Each host root's fallback, established once per process. */
const FALLBACKS = new Map<string, string | undefined>();
