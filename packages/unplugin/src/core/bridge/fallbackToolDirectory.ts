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
