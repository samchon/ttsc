import fs from "node:fs";
import path from "node:path";

/**
 * Read installed executable paths without treating a failed or empty walk as proof.
 *
 * Each supplied root must be readable. Directory entries are walked directly;
 * links are not followed into another installation. At least one regular .exe
 * must be observed across the roots before a Windows path budget can be checked.
 *
 * @evidence contracts/common.md#principled-implementation Native directory observations identify regular executable files; errors propagate and an empty combined population rejects vacuous path-budget success.
 * @evidence contracts/common.md#clear-and-simple-design One recursive walk collects the two existing installed roots and applies one nonempty observation guard, without owning installation or startup.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The operation reads actual directories and files; it does not manufacture an executable, suppress filesystem errors or infer successful startup from a filename.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains readable-root requirements, regular-file selection, link handling and the distinction between enumeration and startup.
 * @evidence contracts/performance.md#efficient-algorithms Each actual directory entry is visited once; retained paths grow with observed executable files, with no second traversal to count them.
 * @evidence contracts/portability.md#os-neutral-implementation Supported Node directory/path APIs preserve native filesystem spellings; case-insensitive .exe suffix selection is the Windows program-layout contract and does not infer filesystem case policy.
 */
export function enumerateInstalledPrograms(roots: readonly string[]): string[] {
  const found: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const location = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(location);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".exe"))
        found.push(location);
    }
  };
  for (const root of roots) walk(path.resolve(root));
  if (found.length === 0)
    throw new Error(
      `No installed executable was observed in ${roots.join(", ")}.`,
    );
  return found;
}
