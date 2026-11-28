import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { readPosixDirectoryEntries } from "../../../../../packages/ttsc/src/plugin/internal/source/readPosixDirectoryEntries";

/**
 * Exercise the byte names API used when typed listings omit names on Bun.
 *
 * @evidence contracts/testing.md#behavioral-verification Selects the Bun compatibility branch under the unit runner and uses native listing and metadata calls on a real directory.
 * @evidence contracts/testing.md#independent-expectations Authored directory and file entries supply the expected name bytes and kinds.
 * @evidence contracts/testing.md#distinguishing-cases The typed listing deliberately omits its names. The names-only listing preserves both kinds and, on POSIX, a filename with an invalid UTF-8 byte.
 * @evidence contracts/testing.md#execution-ownership The test owns its temp directory and restores the runtime marker and filesystem method before cleanup.
 */
export function test_posix_directory_entries_keep_byte_names_with_bun(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-byte-entries-"));
  const byteName =
    process.platform === "win32" ? Buffer.from("file") : Buffer.from([0xff]);
  const file = Buffer.concat([Buffer.from(root + path.sep), byteName]);
  const readdir = fs.readdirSync;
  const bun = Object.getOwnPropertyDescriptor(process.versions, "bun");
  try {
    fs.mkdirSync(path.join(root, "directory"));
    fs.writeFileSync(file, "");
    Object.defineProperty(process.versions, "bun", {
      configurable: true,
      value: "test",
    });
    (fs as { readdirSync: unknown }).readdirSync = (
      directory: Buffer,
      options: { encoding: "buffer"; withFileTypes?: boolean },
    ) =>
      options.withFileTypes
        ? [{ name: undefined }]
        : readdir(directory, { encoding: options.encoding });

    const entries = readPosixDirectoryEntries(Buffer.from(root));
    const directory = entries.find(({ name }) =>
      name.equals(Buffer.from("directory")),
    );
    const bytes = entries.find(({ name }) => name.equals(byteName));
    assert.equal(entries.length, 2);
    assert.equal(directory?.isDirectory(), true);
    assert.equal(bytes?.isFile(), true);
    assert.equal(bytes?.isSymbolicLink(), false);
  } finally {
    fs.readdirSync = readdir;
    if (bun === undefined) Reflect.deleteProperty(process.versions, "bun");
    else Object.defineProperty(process.versions, "bun", bun);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    fs.rmSync(root, { recursive: true });
  }
}
