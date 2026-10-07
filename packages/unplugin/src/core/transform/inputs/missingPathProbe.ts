import path from "node:path";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";

/**
 * Choose an ancestor candidate for a path already observed as missing. The
 * nearest existing directory supplies a child name to check. An existing
 * nondirectory ancestor is returned as a blocker; metadata must also prove that
 * blocker unchanged. The caller must obtain native existence evidence for the
 * returned child; a directory listing alone cannot exclude every native alias.
 *
 * Root exhaustion returns a candidate even when root stat failed, so this
 * selection alone never proves absence. Path parsing follows an explicit
 * filesystem.platform override, or the running Node host when none is
 * supplied.
 *
 * @evidence contracts/common.md#principled-implementation Ancestor traversal stops at a directory, a nondirectory blocker or root; the returned candidate and optional blocker let consumers obtain the separate observations required for an absence proof.
 * @evidence contracts/common.md#clear-and-simple-design One upward walk selects the observation boundary without acquiring watchers or asserting that selection itself certifies a missing path.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Failed ancestor stats continue to parents; root termination is a traversal boundary rather than invented successful accessibility or an unconditional absence result.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain blocker evidence, caller native-proof responsibility, root failure and explicit versus default path dialect; member comments and tags remain visibly separated following documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral traversal selects Node's Windows or POSIX path implementation from the observing filesystem's override, falling back to the host platform, and applies that same dialect to resolution, parent traversal and child-name extraction without inferring case policy.
 * @evidence contracts/performance.md#efficient-algorithms At most D ancestor stats are performed for D path components; parent string operations can cost O(D times path length), and no subtree walk or content read is performed.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This selects one current probe boundary; observers own reuse of candidate observations and blocker metadata across requests.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The walk retains only its current path and returned candidate; native watchers and saved absence proofs belong to consumers.
 */
export function missingPathProbe(
  file: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): {
  /** Existing nondirectory ancestor whose metadata must remain unchanged. */
  blocker?: string;

  /**
   * Directory containing the candidate; exhaustion does not prove
   * accessibility.
   */
  directory: string;

  /** Original child spelling whose native absence the caller must establish. */
  name: string;
} {
  const pathApi =
    (filesystem.platform ?? process.platform) === "win32"
      ? path.win32
      : path.posix;
  let child = pathApi.resolve(file);
  for (;;) {
    const directory = pathApi.dirname(child);
    try {
      const stats = filesystem.stat(directory);
      if (stats.isDirectory()) {
        return { directory, name: pathApi.basename(child) };
      }
      return {
        blocker: directory,
        directory: pathApi.dirname(directory),
        name: pathApi.basename(directory),
      };
    } catch {}
    if (directory === child) {
      return { directory, name: pathApi.basename(child) };
    }
    child = directory;
  }
}
