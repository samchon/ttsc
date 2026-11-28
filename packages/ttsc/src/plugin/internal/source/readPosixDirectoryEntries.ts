import fs from "node:fs";

/**
 * Read POSIX directory names and kinds without decoding the parent or names.
 * Node's typed listing uses a byte parent even for its fallback kind lookup.
 * Bun uses a byte listing followed by native lstat for each name.
 *
 * @evidence contracts/common.md#principled-implementation Both the typed listing and the separate lookup use byte operands. Bun's combined buffer and typed options can omit the name.
 * @evidence contracts/common.md#clear-and-simple-design Source snapshots and SDK traversal share the native reader.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The reader does not assume the filesystem supplies entry types.
 * @evidence contracts/common.md#meaningful-documentation Identifies the name representation and the typed-entry fallback that needs it.
 * @evidence contracts/portability.md#os-neutral-implementation POSIX callers choose the byte interface while Windows callers retain their native string interface.
 * @evidence contracts/performance.md#efficient-algorithms Node retains one typed listing and its native fallback for missing types. Bun uses one names listing and one lstat per name.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The caller needs the current directory entries.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Returns the listing without holding a directory handle.
 */
export function readPosixDirectoryEntries(
  directory: string | Buffer,
): Pick<
  fs.Dirent<Buffer>,
  "name" | "isFile" | "isDirectory" | "isSymbolicLink"
>[] {
  const native =
    typeof directory === "string" ? Buffer.from(directory) : directory;
  if (process.versions.bun === undefined)
    return fs.readdirSync(native, { encoding: "buffer", withFileTypes: true });

  const prefix =
    native.at(-1) === 0x2f ? native : Buffer.concat([native, Buffer.from("/")]);
  return fs.readdirSync(native, { encoding: "buffer" }).map((name) => {
    if (!Buffer.isBuffer(name))
      throw new Error(
        "ttsc: POSIX directory listing did not return byte names",
      );
    const kind = fs.lstatSync(Buffer.concat([prefix, name]));
    return {
      name,
      isFile: () => kind.isFile(),
      isDirectory: () => kind.isDirectory(),
      isSymbolicLink: () => kind.isSymbolicLink(),
    };
  });
}
