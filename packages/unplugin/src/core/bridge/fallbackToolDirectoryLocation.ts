import crypto from "node:crypto";
import path from "node:path";

import { userStateDirectory } from "../transform/filesystem/userStateDirectory";

/**
 * Name a host's private record directory so startup can identify its inventory
 * even when the storage lost qualification after a previous delivery.
 *
 * @evidence contracts/common.md#principled-implementation The native temporary selector, current uid and resolved host root determine the same spelling used by fallbackToolDirectory.
 * @evidence contracts/common.md#clear-and-simple-design The startup address is obtained separately from qualification for writing or replay.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A name neither creates the directory nor certifies that its contents may be accessed.
 * @evidence contracts/common.md#meaningful-documentation The comment explains why cache inventory needs the address independent of access.
 * @evidence contracts/portability.md#os-neutral-implementation The temporary selector supplies long physical spelling and native joins preserve the host volume.
 * @evidence contracts/performance.md#efficient-algorithms Resolving the host root precedes a memo lookup. A miss selects the native temporary parent, hashes the resolved root text and joins the managed path.
 * @evidence contracts/performance.md#reuse-equivalent-work Names are shared for the same resolved root within a process. Consumers separately recheck native storage qualification.
 * @evidence contracts/performance.md#bound-retention-and-release-resources One optional name per distinct resolved root is retained for the process lifetime. No handles are acquired.
 */
export function fallbackToolDirectoryLocation(
  root: string,
): string | undefined {
  const key = path.resolve(root);
  if (!FALLBACKS.has(key)) {
    let directory: string | undefined;
    try {
      directory = path.join(
        userStateDirectory.location(key),
        "hosts",
        crypto.createHash("sha256").update(key).digest("hex").slice(0, 32),
      );
    } catch {
      // No system temporary directory outside this host's project.
    }
    FALLBACKS.set(key, directory);
  }
  return FALLBACKS.get(key);
}

/** Each host root's fallback name, established once per process. */
const FALLBACKS = new Map<string, string | undefined>();
