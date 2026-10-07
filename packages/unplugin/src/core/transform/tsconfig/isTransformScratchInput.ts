import path from "node:path";

import { pathIsWithin } from "../filesystem/pathIsWithin";

/**
 * Whether an input lies lexically in the named disposable transform scratch
 * tree. An absent scratch root excludes no input. This does not resolve links
 * or establish physical ownership of an alias outside that spelling.
 *
 * @evidence contracts/common.md#principled-implementation An absent scratch address cannot own an input; otherwise native lexical containment tests resolved addresses rather than matching a filename prefix.
 * @evidence contracts/common.md#clear-and-simple-design One optional-address guard delegates containment to the shared path boundary helper.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Disposable input classification follows the actual owned scratch root, not a special basename or expected fixture location.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the disposable lexical boundary, absent-root meaning and physical-alias limitation before separated tags.
 * @evidence contracts/portability.md#os-neutral-implementation Node native resolution and the shared containment helper preserve separator, drive and root boundaries without globally folding case or assuming the platform's temporary-directory spelling.
 * @evidence contracts/performance.md#efficient-algorithms An absent root short-circuits all path work. Otherwise native resolution and lexical relative-path comparison scan the input and scratch spellings, with temporary text sized by their lengths; no filesystem traversal or content read is required.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function isTransformScratchInput(
  input: string,
  scratchDirectory: string | undefined,
): boolean {
  return (
    scratchDirectory !== undefined &&
    pathIsWithin(path.resolve(input), path.resolve(scratchDirectory))
  );
}
