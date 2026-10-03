import { TestValidator } from "@nestia/e2e";
import { createMemFS } from "@ttsc/wasm";

import {
  callMutation,
  openFd,
  readFdText,
  readdir,
  stat,
} from "../../internal/callbackFs";

/**
 * Verifies MemFS rename of a directory moves every descendant and follows open
 * descriptors to the new location.
 *
 * Pins the regression where `rename` moved only the named directory node,
 * orphaning every descendant at the old prefix and stranding any file
 * descriptor that pointed inside the moved subtree. A successful rename must
 * re-parent the whole subtree and keep an open `fd` reading the same inode, now
 * reachable at its new path.
 *
 * 1. Seed `/old/child/file.txt` with "abcdef" and open it for reading.
 * 2. Rename `/old` to `/new`.
 * 3. Assert the old prefix is fully gone, the new prefix holds the file and its
 *    bytes (via `readdir` + `stat`, which read the maintained child index and
 *    would expose an orphan), and the pre-existing descriptor still reads
 *    "abcdef".
 *
 * @evidence contracts/testing.md#behavioral-verification createMemFS.fs.rename moves the complete directory subtree and preserves a pre-opened descriptor. Old/new namespace, bytes, listings and size assertions detect orphaned keys or a stranded open node.
 * @evidence contracts/testing.md#independent-expectations Atomic rename changes names while preserving node data and open identity. Authored abcdef, size six, child file.txt and sole root entry new are independent literal expectations for the old/child subtree move.
 * @evidence contracts/testing.md#distinguishing-cases A nested directory with a file and pre-existing read descriptor exercises successful subtree movement. Invalid target collisions have a separate negative test; same-path no-op is covered separately.
 * @evidence contracts/testing.md#execution-ownership test_memfs_rename_directory_reparents_descendants_and_descriptors directly calls fs.rename via callMutation and reads through host/readFdText/readdir/stat on createMemFS. This unit entry owns every old-prefix and preserved-node observation.
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
      "readdir lists the moved descendant under the new parent",
      await readdir(host.fs, "/new/child"),
      ["file.txt"],
    );
    TestValidator.equals(
      "root no longer lists the old directory",
      await readdir(host.fs, "/"),
      ["new"],
    );
    const moved = await stat(host.fs, "/new/child/file.txt");
    TestValidator.predicate(
      "stat reports the moved node as a 6-byte file",
      moved.isFile() && moved.isDirectory() === false && moved.size === 6,
    );
    TestValidator.equals(
      "open descriptor follows the move",
      await readFdText(host.fs, fd, 6),
      "abcdef",
    );
  };
