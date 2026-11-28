import fs from "node:fs";

/**
 * Read POSIX directory names and kinds without decoding the parent or names.
 * Node can need a second lookup for an entry kind the filesystem did not
 * report. Supplying both operands as bytes preserves that lookup on Node 22.
 *
 * @evidence contracts/common.md#principled-implementation The Buffer directory operand and Buffer name encoding keep native Dirent fallback lookups lossless.
 * @evidence contracts/common.md#clear-and-simple-design Source snapshots and SDK traversal share the native reader.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The reader does not assume the filesystem supplies entry types.
 * @evidence contracts/common.md#meaningful-documentation Identifies the name representation and the typed-entry fallback that needs it.
 * @evidence contracts/portability.md#os-neutral-implementation POSIX callers choose the byte interface while Windows callers retain their native string interface.
 * @evidence contracts/performance.md#efficient-algorithms One native listing and any native lookups required by missing types, with one conversion only if the parent was a string.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The caller needs the current directory entries.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Returns the listing without holding a directory handle.
 */
export function readPosixDirectoryEntries(directory: string | Buffer) {
  return fs.readdirSync(
    typeof directory === "string" ? Buffer.from(directory) : directory,
    { encoding: "buffer", withFileTypes: true },
  );
}
