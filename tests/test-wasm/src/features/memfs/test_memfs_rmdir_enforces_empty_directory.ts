import { TestValidator } from "@nestia/e2e";
import { createMemFS } from "@ttsc/wasm";

import { callMutation, expectFsError } from "../../internal/callbackFs";

/**
 * Verifies MemFS rmdir removes an empty directory and rejects every other case
 * without orphaning descendants.
 *
 * The pre-fix `rmdir` delegated straight to `unlink`, which deleted the named
 * node with no type, emptiness, or root check — a non-empty rmdir "succeeded"
 * while leaving every descendant stranded at its old path. RA-13 requires
 * rmdir to enforce POSIX semantics: empty directory succeeds, non-empty is
 * ENOTEMPTY (tree untouched), a file is ENOTDIR, root is EBUSY, and a missing
 * path is ENOENT.
 *
 * 1. Seed an empty `/empty`, a non-empty `/full/child.txt`, and a file `/f.txt`.
 * 2. rmdir the empty directory, then attempt each invalid target.
 * 3. Assert the empty one is gone, each rejection code, and the non-empty
 *    directory still holds its descendant.
 */
export const test_memfs_rmdir_enforces_empty_directory =
  async (): Promise<void> => {
    const host = createMemFS();
    host.mkdirp("/empty");
    host.mkdirp("/full");
    host.writeFile("/full/child.txt", "child");
    host.writeFile("/f.txt", "file");

    await callMutation((cb) => host.fs.rmdir("/empty", cb));

    const codes = {
      nonEmpty: await expectFsError((cb) => host.fs.rmdir("/full", cb)),
      file: await expectFsError((cb) => host.fs.rmdir("/f.txt", cb)),
      root: await expectFsError((cb) => host.fs.rmdir("/", cb)),
      missing: await expectFsError((cb) => host.fs.rmdir("/nope", cb)),
    };

    TestValidator.predicate("empty directory removed", host.exists("/empty") === false);
    TestValidator.equals("rejection codes", codes, {
      nonEmpty: "ENOTEMPTY",
      file: "ENOTDIR",
      root: "EBUSY",
      missing: "ENOENT",
    });
    TestValidator.predicate(
      "non-empty directory and its descendant survive",
      host.exists("/full") && host.readFileText("/full/child.txt") === "child",
    );
  };
