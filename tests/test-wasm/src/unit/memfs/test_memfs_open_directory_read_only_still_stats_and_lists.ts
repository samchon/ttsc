import { TestValidator } from "@nestia/e2e";
import { createMemFS } from "@ttsc/wasm";

import { openResult, readdir, stat } from "../../internal/callbackFs";

/** Node open flags as `createMemFS` advertises them to the Go runtime. */
const O_DIRECTORY = 65536;

/**
 * Verifies opening a directory read-only still yields a descriptor that stats
 * as a directory.
 *
 * This is the sequence Go's `syscall.Open` runs for every directory: open the
 * path, `fstat` the descriptor, and only then `readdir` the path when the stat
 * says directory. Tightening `open` so a write mode or `O_TRUNC` can no longer
 * replace a directory must not close that read-only door, or every `os.ReadDir`
 * inside the wasm compiler would fail.
 *
 * 1. Seed a directory with one child and open it with the default read-only access
 *    mode, then again with `O_DIRECTORY`.
 * 2. `fstat` the read-only descriptor.
 * 3. Assert both opens succeeded, the descriptor stats as a directory, and
 *    `readdir` lists the child.
 */
export const test_memfs_open_directory_read_only_still_stats_and_lists =
  async (): Promise<void> => {
    const host = createMemFS();
    host.writeFile("/dir/child.ts", "CHILD");

    const readOnly = await openResult(host.fs, "/dir", 0);
    const directoryFlag = await openResult(host.fs, "/dir", O_DIRECTORY);
    TestValidator.equals(
      "a directory opens read-only",
      {
        readOnly: readOnly.code,
        readOnlyAllocated: readOnly.fd >= 100,
        directoryFlag: directoryFlag.code,
        directoryFlagAllocated: directoryFlag.fd >= 100,
      },
      {
        readOnly: null,
        readOnlyAllocated: true,
        directoryFlag: null,
        directoryFlagAllocated: true,
      },
    );

    const stats = await new Promise<boolean>((resolve, reject) => {
      host.fs.fstat(readOnly.fd, (err, value) =>
        err ? reject(err) : resolve(value.isDirectory()),
      );
    });
    TestValidator.equals(
      "the descriptor stats as a directory and lists its children",
      {
        fstatIsDirectory: stats,
        statIsDirectory: (await stat(host.fs, "/dir")).isDirectory(),
        entries: await readdir(host.fs, "/dir"),
      },
      { fstatIsDirectory: true, statIsDirectory: true, entries: ["child.ts"] },
    );
  };
