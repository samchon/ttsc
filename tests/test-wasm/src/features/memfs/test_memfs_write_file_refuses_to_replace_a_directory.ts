import { TestValidator } from "@nestia/e2e";
import { createMemFS } from "@ttsc/wasm";

import { expectHostError, readdir, stat } from "../../internal/callbackFs";

/**
 * Verifies MemFS writeFile overwrites a regular file but never replaces a
 * directory, including the root.
 *
 * Turning a directory node into a file left every descendant in the map under a
 * path that is no longer walkable: `exists` and `stat` still answered for both
 * the new file and its stranded children while `readdir` failed with `ENOTDIR`.
 * The caller got neither the mutation it asked for nor an error it could act
 * on.
 *
 * 1. Seed a non-empty directory, an empty directory, and a regular file.
 * 2. Overwrite the regular file, then attempt to write onto each directory and
 *    onto `/` (directly and through a normalized alias).
 * 3. Assert the overwrite replaced the bytes, every directory write was rejected
 *    with `EISDIR`, and each directory plus its descendants survived intact.
 */
export const test_memfs_write_file_refuses_to_replace_a_directory =
  async (): Promise<void> => {
    const host = createMemFS();
    host.writeFile("/tree/leaf.ts", "LEAF");
    host.mkdirp("/empty");
    host.writeFile("/keep.ts", "BEFORE");

    // Positive: overwriting a regular file still replaces its bytes.
    host.writeFile("/keep.ts", "AFTER");
    TestValidator.equals(
      "regular-file overwrite replaces bytes",
      host.readFileText("/keep.ts"),
      "AFTER",
    );

    const codes = {
      nonEmptyDirectory: expectHostError(() => host.writeFile("/tree", "X")),
      emptyDirectory: expectHostError(() => host.writeFile("/empty", "X")),
      root: expectHostError(() => host.writeFile("/", "X")),
      normalizedRoot: expectHostError(() => host.writeFile("/tree/..", "X")),
    };
    TestValidator.equals("rejection codes", codes, {
      nonEmptyDirectory: "EISDIR",
      emptyDirectory: "EISDIR",
      root: "EISDIR",
      normalizedRoot: "EISDIR",
    });

    TestValidator.equals(
      "every directory and descendant survived",
      {
        tree: await readdir(host.fs, "/tree"),
        leaf: host.readFileText("/tree/leaf.ts"),
        empty: await readdir(host.fs, "/empty"),
        root: await readdir(host.fs, "/"),
        treeIsDirectory: (await stat(host.fs, "/tree")).isDirectory(),
        rootIsDirectory: (await stat(host.fs, "/")).isDirectory(),
      },
      {
        tree: ["leaf.ts"],
        leaf: "LEAF",
        empty: [],
        root: ["empty", "keep.ts", "tree"],
        treeIsDirectory: true,
        rootIsDirectory: true,
      },
    );
  };
