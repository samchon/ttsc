/** Directories deliberately outside the shared lexical project walk. */
export function isIgnoredProjectDirectory(name: string): boolean {
  // The residue of what used to be a fifteen-name list, kept to the VCS store,
  // the package manager's tree, and ttsc's own plugin cache. Everything else
  // is decided by the resolved project policy rather than a directory-name
  // guess (samchon/ttsc#1307).
  return name === ".git" || name === ".ttsc" || name === "node_modules";
}
