/**
 * Returns `true` for every declaration-file spelling TypeScript-Go accepts.
 * Besides the standard `.d.ts`, `.d.mts`, and `.d.cts` forms, TypeScript-Go
 * treats an arbitrary-extension source such as `styles.d.css.ts` as a
 * declaration file too.
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
