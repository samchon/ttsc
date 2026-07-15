import { TestValidator } from "@nestia/e2e";
import { createMemFS } from "@ttsc/wasm";

import { callMutation, openFd, readFdText } from "../../internal/callbackFs";

/**
 * Verifies MemFS rename of a directory moves every descendant and follows open
 * descriptors to the new location.
 *
 * Pins the exact defect from RA-13: the pre-fix `rename` moved only the named
 * directory node, orphaning every descendant at the old prefix and stranding
 * any file descriptor that pointed inside the moved subtree. A successful
 * rename must re-parent the whole subtree and keep an open `fd` reading the same
 * inode, now reachable at its new path.
 *
 * 1. Seed `/old/child/file.txt` with "abcdef" and open it for reading.
 * 2. Rename `/old` to `/new`.
 * 3. Assert the old prefix is fully gone, the new prefix holds the file and its
 *    bytes, and the pre-existing descriptor still reads "abcdef".
 */
export const test_memfs_rename_directory_reparents_descendants_and_descriptors =
  async (): Promise<void> => {
    const host = createMemFS();
    host.mkdirp("/old/child");
    host.writeFile("/old/child/file.txt", "abcdef");
    const fd = await openFd(host.fs, "/old/child/file.txt", 0);

    await callMutation((cb) => host.fs.rename("/old", "/new", cb));

    TestValidator.predicate(
      "old subtree fully removed",
      host.exists("/old") === false &&
        host.exists("/old/child") === false &&
        host.exists("/old/child/file.txt") === false,
    );
    TestValidator.predicate(
      "new subtree materialized",
      host.exists("/new") &&
        host.exists("/new/child") &&
        host.exists("/new/child/file.txt"),
    );
    TestValidator.equals(
      "moved file bytes preserved",
      host.readFileText("/new/child/file.txt"),
      "abcdef",
    );
    TestValidator.equals(
      "open descriptor follows the move",
      await readFdText(host.fs, fd, 6),
      "abcdef",
    );
  };
