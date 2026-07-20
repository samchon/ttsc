import { TestValidator } from "@nestia/e2e";
import { createMemFS } from "@ttsc/wasm";

import { openResult, readdir, stat } from "../../internal/callbackFs";

/** Node open flags as `createMemFS` advertises them to the Go runtime. */
const O_WRONLY = 1;
const O_RDWR = 2;
const O_TRUNC = 512;

/**
 * Verifies MemFS open with `O_TRUNC` empties a regular file and rejects a
 * directory target without stranding its descendants.
 *
 * The truncate branch replaced whatever node sat at the path with an empty
 * file, so truncating a directory succeeded, orphaned the whole subtree, and
 * broke `readdir` on a path `exists` still reported. It also allocated the
 * descriptor before applying the truncation, so a late failure would have
 * leaked an fd.
 *
 * 1. Truncate a regular file through `open` and confirm it is empty.
 * 2. Attempt `O_TRUNC` on a non-empty directory and on the root.
 * 3. Assert both are rejected with `EISDIR` and `fd` -1, and that each directory
 *    still stats as a directory with every descendant readable.
 */
export const test_memfs_open_trunc_never_turns_a_directory_into_a_file =
  async (): Promise<void> => {
    const host = createMemFS();
    host.writeFile("/tree/leaf.ts", "LEAF");
    host.writeFile("/file.ts", "CONTENT");

    // Positive: O_TRUNC on a regular file still empties it.
    const truncated = await openResult(host.fs, "/file.ts", O_TRUNC | O_WRONLY);
    TestValidator.equals(
      "O_TRUNC empties a regular file",
      { code: truncated.code, text: host.readFileText("/file.ts") },
      { code: null, text: "" },
    );

    const results = {
      directory: await openResult(host.fs, "/tree", O_TRUNC | O_WRONLY),
      directoryReadWrite: await openResult(host.fs, "/tree", O_TRUNC | O_RDWR),
      root: await openResult(host.fs, "/", O_TRUNC | O_WRONLY),
    };
    TestValidator.equals("rejections allocate no descriptor", results, {
      directory: { code: "EISDIR", fd: -1 },
      directoryReadWrite: { code: "EISDIR", fd: -1 },
      root: { code: "EISDIR", fd: -1 },
    });

    TestValidator.equals(
      "directories and descendants are untouched",
      {
        treeIsDirectory: (await stat(host.fs, "/tree")).isDirectory(),
        treeEntries: await readdir(host.fs, "/tree"),
        leaf: host.readFileText("/tree/leaf.ts"),
        rootIsDirectory: (await stat(host.fs, "/")).isDirectory(),
        rootEntries: await readdir(host.fs, "/"),
      },
      {
        treeIsDirectory: true,
        treeEntries: ["leaf.ts"],
        leaf: "LEAF",
        rootIsDirectory: true,
        rootEntries: ["file.ts", "tree"],
      },
    );
  };
