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
 *
 * @evidence contracts/testing.md#behavioral-verification createMemFS.fs.open still permits read-only directory handles whose fstat/stat and readdir agree. A blanket directory rejection or a descriptor misclassified as file fails the literal successful results.
 * @evidence contracts/testing.md#independent-expectations Go-style directory traversal opens read-only then stats and lists. The seeded child.ts and literal true directory classifications are independent input/oracles; a successful handle must be allocated rather than fd -1.
 * @evidence contracts/testing.md#distinguishing-cases Default read-only and O_DIRECTORY both open the same one-child directory. Write and truncate directory refusals are covered by the access-mode and open-trunc siblings.
 * @evidence contracts/testing.md#execution-ownership test_memfs_open_directory_read_only_still_stats_and_lists invokes createMemFS, openResult, direct fs.fstat and stat/readdir adapters. This unit owns both opens and the exact child list without executing Go traversal or a Wasm host.
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
