import { TestValidator } from "@nestia/e2e";
import { createMemFS } from "@ttsc/wasm";

import { expectFsError } from "../../internal/callbackFs";

/**
 * Verifies MemFS rename rejects every ill-formed target with the right POSIX
 * code and leaves the tree byte-for-byte unchanged.
 *
 * These are the negative twins of the successful move: a rename that cannot
 * satisfy its contract must not partially mutate. RA-13 requires each rejected
 * class (missing source, root, self-into-descendant, absent/non-directory
 * destination parent, file-vs-directory collisions, non-empty overwrite) to
 * fail cleanly rather than delete or half-move nodes.
 *
 * 1. Seed a fixed tree with files, nested and empty directories.
 * 2. Attempt every invalid rename and record its rejection code.
 * 3. Assert each expected code and that the whole tree is still intact with no
 *    stray destination nodes.
 */
export const test_memfs_rename_rejects_invalid_targets_without_partial_state =
  async (): Promise<void> => {
    const host = createMemFS();
    host.mkdirp("/dir/sub");
    host.writeFile("/dir/a.txt", "AAA");
    host.writeFile("/dir/sub/b.txt", "BBB");
    host.writeFile("/file.txt", "FILE");
    host.mkdirp("/empty");
    host.mkdirp("/empty2");

    const codes = {
      missingSource: await expectFsError((cb) =>
        host.fs.rename("/nope", "/x", cb),
      ),
      root: await expectFsError((cb) => host.fs.rename("/", "/x", cb)),
      selfDescendant: await expectFsError((cb) =>
        host.fs.rename("/dir", "/dir/sub/inner", cb),
      ),
      absentParent: await expectFsError((cb) =>
        host.fs.rename("/file.txt", "/nonexistent/x", cb),
      ),
      fileParent: await expectFsError((cb) =>
        host.fs.rename("/file.txt", "/file.txt/x", cb),
      ),
      fileOntoDir: await expectFsError((cb) =>
        host.fs.rename("/file.txt", "/empty", cb),
      ),
      dirOntoFile: await expectFsError((cb) =>
        host.fs.rename("/dir", "/file.txt", cb),
      ),
      dirOntoNonEmptyDir: await expectFsError((cb) =>
        host.fs.rename("/empty2", "/dir", cb),
      ),
    };

    TestValidator.equals("rejection codes", codes, {
      missingSource: "ENOENT",
      root: "EBUSY",
      selfDescendant: "EINVAL",
      absentParent: "ENOENT",
      fileParent: "ENOTDIR",
      fileOntoDir: "EISDIR",
      dirOntoFile: "ENOTDIR",
      dirOntoNonEmptyDir: "ENOTEMPTY",
    });

    TestValidator.predicate(
      "no stray destination nodes were created",
      host.exists("/x") === false &&
        host.exists("/nonexistent") === false &&
        host.exists("/dir/sub/inner") === false,
    );
    TestValidator.equals(
      "tree contents intact",
      {
        a: host.readFileText("/dir/a.txt"),
        b: host.readFileText("/dir/sub/b.txt"),
        file: host.readFileText("/file.txt"),
        empty: host.exists("/empty"),
        empty2: host.exists("/empty2"),
      },
      {
        a: "AAA",
        b: "BBB",
        file: "FILE",
        empty: true,
        empty2: true,
      },
    );
  };
