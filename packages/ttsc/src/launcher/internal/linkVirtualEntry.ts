import fs from "node:fs";

/**
 * Mirror one directory entry of the project into ttsx's virtual layout.
 *
 * Directories become junctions on Windows and symlinks elsewhere; files are
 * hard-linked, or copied across devices. A symbolic link is re-linked as is,
 * except where Windows refuses file symlinks without a privilege: a link to a
 * directory becomes a junction, a link to a file falls back to a hard link or a
 * copy, and a dangling link is skipped because no fallback can materialize it.
 *
 * Exported for direct exercise by the ttsx e2e suite: the Windows fallback
 * branches cannot be reached through a spawned run on CI, because creating a
 * file-symlink fixture needs the very privilege the fallback avoids.
 */
export function linkVirtualEntry(
  realEntry: string,
  virtualEntry: string,
  entry: fs.Dirent,
): void {
  if (entry.isDirectory()) {
    // Use junction points on Windows; plain symlinks elsewhere.
    fs.symlinkSync(
      realEntry,
      virtualEntry,
      process.platform === "win32" ? "junction" : undefined,
    );
    return;
  }
  if (entry.isFile()) {
    try {
      // Hard-link first: cheap, preserves inode, no extra disk usage.
      fs.linkSync(realEntry, virtualEntry);
    } catch {
      // Cross-device or unsupported filesystem: fall back to a full copy.
      fs.copyFileSync(realEntry, virtualEntry);
    }
    return;
  }
  if (
    process.platform === "win32" &&
    entry.isSymbolicLink() &&
    isDirectorySymlinkTarget(realEntry)
  ) {
    fs.symlinkSync(realEntry, virtualEntry, "junction");
    return;
  }
  // Symlinks (and other special entries) are re-symlinked as-is. On Windows,
  // a file symlink needs SeCreateSymbolicLinkPrivilege (admin or Developer
  // Mode), so mirror the plain-file branch's hard-link/copy fallback instead
  // of failing the run (#306). A link whose target no longer exists is
  // skipped: it can serve no module, and none of the fallbacks can
  // materialize it without symlink privileges.
  try {
    fs.symlinkSync(realEntry, virtualEntry);
  } catch {
    if (!fs.existsSync(realEntry)) {
      return;
    }
    try {
      fs.linkSync(realEntry, virtualEntry);
    } catch {
      fs.copyFileSync(realEntry, virtualEntry);
    }
  }
}

function isDirectorySymlinkTarget(realEntry: string): boolean {
  try {
    return fs.statSync(realEntry).isDirectory();
  } catch {
    return false;
  }
}
