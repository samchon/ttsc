import fs from "node:fs";

/**
 * Mirror one directory entry of the project into ttsx's virtual layout.
 *
 * Directories become junctions on Windows and symlinks elsewhere; files are
 * hard-linked, or copied when hard-link creation fails. On Windows a symbolic
 * link whose target is observed as a directory becomes a junction. Other entries
 * get a symlink to the original entry path, rather than a copy of its readlink
 * text. If that creation fails on any host, an existsSync false result skips the
 * entry; otherwise a hard-link attempt falls back to copying on failure. A
 * dangling target can therefore be mirrored successfully or skipped after a
 * failed symlink attempt. Failure alone does not identify a privilege error.
 *
 * The launcher enumerates source entries and avoids known existing virtual
 * entries before calling this operation. That is not an atomic destination
 * reservation: a racing or direct caller can reach the copy fallback with an
 * existing destination. Native copy defaults can replace its bytes. The runtime
 * generation owner controls destination lifetime and cleanup; this operation
 * retains no open descriptor or cleanup handle after returning.
 *
 * @evidence contracts/common.md#principled-implementation The entry kind selects a directory link, file hard-link/copy or symlink route; a missing target cannot be materialized by the file-copy fallback.
 * @evidence contracts/common.md#clear-and-simple-design One mirror operation owns link creation and its native fallback; the private target-kind helper only resolves directory symlinks.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Windows directory targets select junctions directly; hard-link and final symlink failures trigger the documented native fallbacks without errno attribution. No test identity changes production behavior, and copy/skip outcomes retain their documented ownership and failure limits.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain link-to-original-path representation, failure-driven copy/absence behavior, destination replacement and caller-owned lifetime, with acknowledgment tags separated from that explanation.
 * @evidence contracts/portability.md#os-neutral-implementation Node filesystem APIs represent actual link/copy capabilities; Windows junction selection is explicit, while failed hard-link/symlink operations determine the fallback rather than guessed volume policy.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Synchronous native operations leave no retained descriptor or in-memory entry history. Created links/files persist until the caller removes the virtual generation; copying can allocate the full target contents, with no byte quota at this boundary.
 * @evidence contracts/performance.md#efficient-algorithms One entry selects a fixed number of native link/stat/existence attempts, without recursive directory enumeration. Copy fallback performs content-sized native work; path/target lookup and payload sizes are not capped by the entry count.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation establishes a caller-owned destination rather than coordinating an equivalent producer or caching native capability/target observations. Different destinations require their own materialization and current native failures select the fallback.
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
  // Link to the original entry path, including for symlinks and special entries.
  // Windows file-link privilege restrictions motivated the fallback, but any
  // creation error reaches it on every host. Only after that failure does an
  // existsSync false result skip the entry; otherwise attempt hard-link/copy.
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
