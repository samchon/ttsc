import fs from "node:fs";
import path from "node:path";

import { realpath } from "./realpath";

/**
 * Return the linked directory components between `root` and `file`.
 *
 * Retargeting a symlink or junction moves every path beneath it without an
 * event on those paths, so each link along the way must be tracked in its own
 * right. Results are memoized per component key, and a missing component stops
 * the walk, because nothing below a missing directory can exist yet.
 *
 * @evidence contracts/common.md#principled-implementation The component walk stays lexically inside the root, inspects each ancestor link, and stops after missing topology because later descendants cannot exist through that path.
 * @evidence contracts/common.md#clear-and-simple-design Caller-owned memo tables share repeated component inspection; physical-target reading stays in the existing realpath helper.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Native lstat determines links, and a failed component read is conservatively remembered as missing rather than fabricated as a regular directory.
 * @evidence contracts/common.md#meaningful-documentation The prose explains link retargeting, memo ownership, and the stopping condition that keeps the walk bounded by path depth.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral component traversal uses native relative/absolute boundaries, lstat link classification, and the caller's directory-policy key, rather than guessing links from names or separators.
 * @evidence contracts/performance.md#efficient-algorithms The walk visits each ancestor at most once for this path and stops at known missing topology, avoiding a filesystem-tree scan.
 * @evidence contracts/performance.md#reuse-equivalent-work Shared caller-owned component and missing memos reuse identical topology queries; the observer invalidates those facts after rename and ownership changes.
 * @evidence contracts/performance.md#bound-retention-and-release-resources This operation opens no retained handles and stores only traversed components in caller-owned tables; the observer's registration removal and disposal clear those tables.
 */
export function linkedComponents(
  file: string,
  root: string,
  cached: Map<string, string | null>,
  missing: Set<string>,
  keyOf: (file: string) => string,
): string[] {
  const relative = path.relative(root, file);
  if (
    relative === "" ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    return [];
  const output: string[] = [];
  let current = path.resolve(root);
  for (const component of relative.split(path.sep).slice(0, -1)) {
    current = path.join(current, component);
    const key = keyOf(current);
    if (missing.has(key)) break;
    const known = cached.get(key);
    if (known !== undefined) {
      if (known !== null) output.push(current);
      continue;
    }
    try {
      if (fs.lstatSync(current).isSymbolicLink()) {
        cached.set(key, realpath(current) ?? current);
        output.push(current);
      } else {
        cached.set(key, null);
      }
    } catch {
      missing.add(key);
      break;
    }
  }
  return output;
}
