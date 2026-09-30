import { TestValidator } from "@nestia/e2e";
import { createMemFS } from "@ttsc/wasm";

import { openResult, readdir } from "../../internal/callbackFs";

/** Node open flags as `createMemFS` advertises them to the Go runtime. */
const O_WRONLY = 1;
const O_CREAT = 64;

/**
 * Verifies MemFS open with `O_CREAT` creates a file inside an existing
 * directory and refuses every path whose parent chain cannot hold it.
 *
 * The low-level `open` used to run the same silent `ensureParentDirs` walk as
 * `writeFile`, so it invented a whole directory chain the syscall never
 * promised, and it created files below file-valued ancestors. Parent creation
 * belongs to `writeFile` and `mkdirp`; `open` must fail instead.
 *
 * 1. Create `/dir` and open `/dir/made.js` with `O_CREAT`, asserting the file
 *    appears.
 * 2. Attempt `O_CREAT` below a file ancestor, below a missing chain, and through a
 *    normalized alias of the missing chain.
 * 3. Assert each rejection carries its code with `fd` -1, and that no directory or
 *    file node was invented anywhere.
 */
export const test_memfs_open_create_requires_an_existing_directory_parent =
  async (): Promise<void> => {
    const host = createMemFS();
    host.mkdirp("/dir");
    host.writeFile("/base", "BASE");

    // Positive: creating inside a directory that exists still works.
    const created = await openResult(
      host.fs,
      "/dir/made.js",
      O_CREAT | O_WRONLY,
    );
    TestValidator.equals(
      "O_CREAT inside an existing directory creates the file",
      {
        code: created.code,
        allocated: created.fd >= 100,
        exists: host.exists("/dir/made.js"),
      },
      { code: null, allocated: true, exists: true },
    );

    const results = {
      belowFile: await openResult(
        host.fs,
        "/base/generated.js",
        O_CREAT | O_WRONLY,
      ),
      missingChain: await openResult(host.fs, "/a/b/c.ts", O_CREAT | O_WRONLY),
      normalizedAlias: await openResult(
        host.fs,
        "/dir/.././/a/b/c.ts",
        O_CREAT | O_WRONLY,
      ),
    };
    TestValidator.equals(
      "rejections allocate no descriptor",
      {
        belowFile: results.belowFile,
        missingChain: results.missingChain,
        normalizedAlias: results.normalizedAlias,
      },
      {
        belowFile: { code: "ENOTDIR", fd: -1 },
        missingChain: { code: "ENOENT", fd: -1 },
        normalizedAlias: { code: "ENOENT", fd: -1 },
      },
    );

    TestValidator.equals(
      "no node was invented by a rejected open",
      {
        child: host.exists("/base/generated.js"),
        chainRoot: host.exists("/a"),
        chainLeaf: host.exists("/a/b"),
        base: host.readFileText("/base"),
        root: await readdir(host.fs, "/"),
      },
      {
        child: false,
        chainRoot: false,
        chainLeaf: false,
        base: "BASE",
        root: ["base", "dir"],
      },
    );
  };
