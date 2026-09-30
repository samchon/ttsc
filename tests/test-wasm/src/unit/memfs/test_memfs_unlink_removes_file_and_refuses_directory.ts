import { TestValidator } from "@nestia/e2e";
import { createMemFS } from "@ttsc/wasm";

import { callMutation, expectFsError } from "../../internal/callbackFs";

/**
 * Verifies MemFS unlink removes a file but refuses a directory so Go's
 * os.Remove falls through to rmdir.
 *
 * Go's `os.Remove` tries `unlink` first and only falls back to `rmdir` when it
 * fails. The pre-fix `unlink` deleted any node, so unlinking a directory
 * "succeeded" and dropped only its node while orphaning descendants and
 * skipping the emptiness check rmdir would have run. The fix makes a directory
 * unlink reject with EISDIR; a missing path is still ENOENT and a plain file
 * still unlinks.
 *
 * 1. Seed a file `/f.txt` and a non-empty directory `/d/child.txt`.
 * 2. Unlink the file (succeeds); attempt to unlink the directory and a missing
 *    path.
 * 3. Assert the file is gone, the directory rejects EISDIR with its descendant
 *    intact, and the missing path is ENOENT.
 */
export const test_memfs_unlink_removes_file_and_refuses_directory =
  async (): Promise<void> => {
    const host = createMemFS();
    host.writeFile("/f.txt", "file");
    host.mkdirp("/d");
    host.writeFile("/d/child.txt", "child");

    await callMutation((cb) => host.fs.unlink("/f.txt", cb));

    const codes = {
      directory: await expectFsError((cb) => host.fs.unlink("/d", cb)),
      missing: await expectFsError((cb) => host.fs.unlink("/nope", cb)),
    };

    TestValidator.predicate("file unlinked", host.exists("/f.txt") === false);
    TestValidator.equals("rejection codes", codes, {
      directory: "EISDIR",
      missing: "ENOENT",
    });
    TestValidator.predicate(
      "directory and descendant survive the refused unlink",
      host.exists("/d") && host.readFileText("/d/child.txt") === "child",
    );
  };
