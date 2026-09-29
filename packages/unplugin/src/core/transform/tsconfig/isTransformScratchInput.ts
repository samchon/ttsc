import path from "node:path";

import { pathIsWithin } from "../filesystem/pathIsWithin";

/**
 * Whether an input lies in the named disposable transform scratch tree.
 *
 * @evidence contracts/common.md#principled-implementation An absent scratch address cannot own an input; otherwise native lexical containment tests resolved addresses rather than matching a filename prefix.
 * @evidence contracts/common.md#clear-and-simple-design One optional-address guard delegates containment to the shared path boundary helper.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Disposable input classification follows the actual owned scratch root, not a special basename or expected fixture location.
 * @evidence contracts/common.md#meaningful-documentation The native comment names the scratch ownership boundary and the optional-root behavior remains visible in the predicate.
 * @evidence contracts/portability.md#os-neutral-implementation Node native resolution and the shared containment helper preserve separator, drive and root boundaries without globally folding case or assuming the platform's temporary-directory spelling.
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
