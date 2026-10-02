/**
 * Returns `true` for every declaration-file spelling TypeScript-Go accepts.
 * Besides the standard `.d.ts`, `.d.mts`, and `.d.cts` forms, TypeScript-Go
 * treats an arbitrary-extension source such as `styles.d.css.ts` as a
 * declaration file too.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Taking the basename after separator normalization prevents directory names
 *   containing .d. from classifying source; suffixes cover module declaration
 *   forms and the arbitrary-extension .d.*.ts convention.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One basename classifier owns the declaration spelling policy for adapters.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The suffix branches express compiler declaration conventions rather than
 *   paths from a particular project or test.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose explains the non-obvious arbitrary-extension form and separator
 *   handling; tags are separated as documentation guidance requires.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Performs no filesystem, path or process operation of its own.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   No loop or traversal of its own; constant work apart from delegated
 *   calls.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function isDeclarationFile(id: string): boolean {
  // Module ids can cross process/platform boundaries (for example, a Windows
  // id inspected by a POSIX host). TypeScript-Go normalizes both separators
  // before taking the basename, so a `.d.` directory component must not turn
  // an ordinary source into a declaration file.
  const normalized = id.replaceAll("\\", "/");
  const base = normalized.slice(normalized.lastIndexOf("/") + 1);
  return (
    base.endsWith(".d.ts") ||
    base.endsWith(".d.mts") ||
    base.endsWith(".d.cts") ||
    (base.endsWith(".ts") && base.includes(".d."))
  );
}
