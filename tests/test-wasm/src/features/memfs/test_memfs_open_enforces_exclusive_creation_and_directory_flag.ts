import { TestValidator } from "@nestia/e2e";
import { createMemFS } from "@ttsc/wasm";

import { openResult, readdir } from "../../internal/callbackFs";

/** Node open flags as `createMemFS` advertises them to the Go runtime. */
const O_WRONLY = 1;
const O_CREAT = 64;
const O_EXCL = 128;
const O_DIRECTORY = 65536;

/**
 * Verifies MemFS open honors the `O_EXCL` and `O_DIRECTORY` flags it advertises
 * to the Go runtime.
 *
 * `open` consulted only `O_CREAT` and `O_TRUNC`, so `O_CREAT | O_EXCL` handed
 * back a descriptor for a path that already existed — defeating the one
 * guarantee exclusive creation offers — and `O_DIRECTORY` accepted a regular
 * file. Both constants are published by `createMemFS().fs.constants`, so Go
 * translates its own flags into them and trusts the answer.
 *
 * 1. Exclusively create a new path, then repeat the same call on the now existing
 *    path.
 * 2. Open a regular file with `O_DIRECTORY`, and a directory with and without it.
 * 3. Assert the second exclusive create is `EEXIST`, `O_DIRECTORY` on a file is
 *    `ENOTDIR`, both allocate no descriptor, and the tree is unchanged.
 */
export const test_memfs_open_enforces_exclusive_creation_and_directory_flag =
  async (): Promise<void> => {
    const host = createMemFS();
    host.mkdirp("/dir");
    host.writeFile("/f.txt", "abc");

    // Positive: exclusive creation of a path that does not exist yet.
    const created = await openResult(
      host.fs,
      "/fresh.txt",
      O_CREAT | O_EXCL | O_WRONLY,
    );
    TestValidator.equals(
      "O_EXCL creates a path that is free",
      { code: created.code, allocated: created.fd >= 100 },
      { code: null, allocated: true },
    );

    TestValidator.equals(
      "flag conflicts are rejected without a descriptor",
      {
        exclusiveOnFile: await openResult(
          host.fs,
          "/f.txt",
          O_CREAT | O_EXCL | O_WRONLY,
        ),
        exclusiveOnFresh: await openResult(
          host.fs,
          "/fresh.txt",
          O_CREAT | O_EXCL | O_WRONLY,
        ),
        exclusiveOnDirectory: await openResult(
          host.fs,
          "/dir",
          O_CREAT | O_EXCL,
        ),
        directoryFlagOnFile: await openResult(host.fs, "/f.txt", O_DIRECTORY),
        directoryFlagOnMissing: await openResult(
          host.fs,
          "/dir/new",
          O_CREAT | O_DIRECTORY,
        ),
      },
      {
        exclusiveOnFile: { code: "EEXIST", fd: -1 },
        exclusiveOnFresh: { code: "EEXIST", fd: -1 },
        exclusiveOnDirectory: { code: "EEXIST", fd: -1 },
        directoryFlagOnFile: { code: "ENOTDIR", fd: -1 },
        directoryFlagOnMissing: { code: "ENOTDIR", fd: -1 },
      },
    );

    // Positive twin: O_DIRECTORY on an actual directory is accepted.
    const directory = await openResult(host.fs, "/dir", O_DIRECTORY);
    TestValidator.equals(
      "O_DIRECTORY accepts a directory",
      { code: directory.code, allocated: directory.fd >= 100 },
      { code: null, allocated: true },
    );

    TestValidator.equals(
      "no rejected open changed the tree",
      {
        file: host.readFileText("/f.txt"),
        fresh: host.readFileText("/fresh.txt"),
        directory: await readdir(host.fs, "/dir"),
        root: await readdir(host.fs, "/"),
      },
      {
        file: "abc",
        fresh: "",
        directory: [],
        root: ["dir", "f.txt", "fresh.txt"],
      },
    );
  };
