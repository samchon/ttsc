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
 *
 * @evidence contracts/common.md#principled-implementation The entry kind selects a directory link, file hard-link/copy or symlink route; a missing target cannot be materialized by the file-copy fallback.
 * @evidence contracts/common.md#clear-and-simple-design One mirror operation owns link creation and its native fallback; the private target-kind helper only resolves directory symlinks.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Copying after an unavailable hard link and junctions after Windows symlink restrictions address supported filesystem differences; no test identity changes production behavior.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain alias/copy behavior, dangling targets and Windows privilege constraints, with acknowledgment tags separated from that explanation.
 * @evidence contracts/portability.md#os-neutral-implementation Node filesystem APIs represent actual link/copy capabilities; Windows junction selection is explicit, while failed hard-link/symlink operations determine the fallback rather than guessed volume policy.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources linkVirtualEntry declares a signature only; the implementation owns acquisition and release of resources.
 * @evidenceExclude contracts/performance.md#efficient-algorithms linkVirtualEntry declares a signature only; the implementation owns the processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work linkVirtualEntry declares a signature only; the implementation owns any shared work.
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
  // of failing the run. A link whose target no longer exists is
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
