import { TestValidator } from "@nestia/e2e";
import { createMemFS } from "@ttsc/wasm";

import { expectFsError } from "../../internal/callbackFs";

/**
 * Verifies MemFS rename rejects every ill-formed target with the right POSIX
 * code and leaves the tree byte-for-byte unchanged.
 *
 * These are the negative twins of the successful move: a rename that cannot
 * satisfy its contract must not partially mutate. Each rejected class (missing
 * source, root, self-into-descendant, absent/non-directory destination parent,
 * file-vs-directory collisions, non-empty overwrite) must fail cleanly rather
 * than delete or half-move nodes.
 *
 * 1. Seed a fixed tree with files, nested and empty directories.
 * 2. Attempt every invalid rename and record its rejection code.
 * 3. Assert each expected code and that the whole tree is still intact with no
 *    stray destination nodes.
 *
 * @evidence contracts/testing.md#behavioral-verification createMemFS.fs.rename rejects missing source, root move, descendant cycle, invalid parent and incompatible destination without changing seeded bytes or inventing nodes. Exact codes and remaining tree distinguish partial failed moves.
 * @evidence contracts/testing.md#independent-expectations The rename contract assigns ENOENT, EBUSY, EINVAL, ENOTDIR, EISDIR and ENOTEMPTY to the authored invalid classes. Literal AAA/BBB/FILE, empty-directory presence and absent targets independently represent the pre-operation state.
 * @evidence contracts/testing.md#distinguishing-cases Eight named failures span source, destination-parent, type compatibility and nonempty replacement. File/directory success and same-path success are retained by their separate sibling entries.
 * @evidence contracts/testing.md#execution-ownership test_memfs_rename_rejects_invalid_targets_without_partial_state calls fs.rename through expectFsError for all eight object keys on one createMemFS host and compares the complete literal code object and preserved tree. No dynamic test registration hides individual failure identities.
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
