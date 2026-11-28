import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { readPosixDirectoryEntries } from "../../../../../packages/ttsc/src/plugin/internal/source/readPosixDirectoryEntries";

/**
 * Exercise the byte names API used when typed listings omit names on Bun.
 *
 * @evidence contracts/testing.md#behavioral-verification Selects the Bun compatibility branch under the unit runner and uses native listing and metadata calls on a real directory.
 * @evidence contracts/testing.md#independent-expectations Authored directory and Go file entries supply the expected name bytes and kinds before a transient sibling is removed.
 * @evidence contracts/testing.md#distinguishing-cases The typed listing deliberately omits its names. The names-only listing preserves both kinds and an invalid UTF-8 byte wherever the volume admits one. Windows and volumes returning EILSEQ use an ASCII name instead. A vanished child leaves both Go files present, a vanished parent reports ENOENT, and other kind errors fail the read.
 * @evidence contracts/testing.md#execution-ownership The test owns its temp directory and restores the runtime marker and filesystem method before cleanup.
 */
export function test_posix_directory_entries_keep_byte_names_with_bun(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-byte-entries-"));
  let byteName =
    process.platform === "win32" ? Buffer.from("file") : Buffer.from([0xff]);
  let file = Buffer.concat([Buffer.from(root + path.sep), byteName]);
  const transient = path.join(root, "transient.go");
  const removed = path.join(root, "directory", "removed");
  const readdir = fs.readdirSync;
  const lstat = fs.lstatSync;
  const bun = Object.getOwnPropertyDescriptor(process.versions, "bun");
  try {
    fs.mkdirSync(path.join(root, "directory"));
    fs.mkdirSync(removed);
    fs.writeFileSync(path.join(removed, "entry.go"), "package fixture");
    fs.writeFileSync(path.join(root, "main.go"), "package fixture");
    fs.writeFileSync(path.join(root, "helper.go"), "package fixture");
    fs.writeFileSync(transient, "package fixture");
    try {
      fs.writeFileSync(file, "");
    } catch (error) {
      // UTF-8-only volumes, such as APFS, refuse the raw name.
      if ((error as NodeJS.ErrnoException).code !== "EILSEQ") throw error;
      byteName = Buffer.from("file");
      file = Buffer.concat([Buffer.from(root + path.sep), byteName]);
      fs.writeFileSync(file, "");
    }
    Object.defineProperty(process.versions, "bun", {
      configurable: true,
      value: "test",
    });
    (fs as { readdirSync: unknown }).readdirSync = (
      directory: Buffer,
      options: { encoding: "buffer"; withFileTypes?: boolean },
    ) => {
      if (options.withFileTypes) return [{ name: undefined }];
      const result = readdir(directory, { encoding: options.encoding });
      if (directory.equals(Buffer.from(root)) && fs.existsSync(transient))
        fs.unlinkSync(transient);
      if (directory.equals(Buffer.from(removed)))
        fs.rmSync(removed, { recursive: true });
      return result;
    };

    const entries = readPosixDirectoryEntries(Buffer.from(root));
    const directory = entries.find(({ name }) =>
      name.equals(Buffer.from("directory")),
    );
    const bytes = entries.find(({ name }) => name.equals(byteName));
    assert.equal(entries.length, 4);
    assert.equal(directory?.isDirectory(), true);
    assert.equal(bytes?.isFile(), true);
    assert.equal(bytes?.isSymbolicLink(), false);
    assert.deepEqual(
      entries
        .filter((entry) => entry.isFile())
        .map(({ name }) => name.toString())
        .filter((name) => name.endsWith(".go"))
        .sort(),
      ["helper.go", "main.go"],
    );
    assert.throws(() => readPosixDirectoryEntries(removed), { code: "ENOENT" });
    for (const code of ["EACCES", "ENOTDIR"]) {
      const failure = Object.assign(new Error(code), { code });
      (fs as { lstatSync: unknown }).lstatSync = (candidate: Buffer) => {
        if (candidate.subarray(-8).equals(Buffer.from("/main.go")))
          throw failure;
        return lstat(candidate);
      };
      assert.throws(
        () => readPosixDirectoryEntries(root),
        (error) =>
          code === "EACCES"
            ? error === failure
            : error instanceof Error && error.cause === failure,
      );
    }
  } finally {
    fs.readdirSync = readdir;
    fs.lstatSync = lstat;
    if (bun === undefined) Reflect.deleteProperty(process.versions, "bun");
    else Object.defineProperty(process.versions, "bun", bun);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    fs.rmSync(root, { recursive: true });
  }
}
