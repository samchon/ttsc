import { TestValidator } from "@nestia/e2e";
import { createMemFS } from "@ttsc/wasm";

import { callMutation } from "../../internal/callbackFs";

/**
 * Verifies MemFS rename: a file moves to the destination with its bytes intact
 * and the source path gone.
 *
 * Pins the transformation direction of `createMemFS().fs.rename` on a file. The
 * pre-fix implementation `nodes.delete(src); nodes.set(dest, node)` happened to
 * work for a single file, so this positive case is the baseline the directory
 * and overwrite cases build on: a successful callback must mean the tree
 * actually reflects the move, not merely that the callback fired.
 *
 * 1. Seed `/a.txt` with "hello".
 * 2. Rename `/a.txt` to `/b.txt`.
 * 3. Assert `/a.txt` is gone, `/b.txt` exists, and its bytes are still "hello".
 *
 * @evidence contracts/testing.md#behavioral-verification createMemFS.fs.rename removes the source name, creates the destination and retains file bytes. A callback-only success without the move or a data-losing move fails the namespace and literal text assertions.
 * @evidence contracts/testing.md#independent-expectations POSIX rename transfers a regular-file name without changing its contents. The independently seeded hello text and authored a.txt/b.txt paths establish both transformation direction and unchanged data.
 * @evidence contracts/testing.md#distinguishing-cases One file moving to a previously absent destination is the positive baseline. Existing-destination replacement and invalid targets are owned by the overwrite and atomic-rejection siblings.
 * @evidence contracts/testing.md#execution-ownership test_memfs_rename_file_preserves_bytes calls createMemFS.fs.rename through callMutation, then host.exists and readFileText. Its single source-unit entry executes the owning in-memory operation without a consumer process.
 */
export const test_memfs_rename_file_preserves_bytes =
  async (): Promise<void> => {
    const host = createMemFS();
    host.writeFile("/a.txt", "hello");

    await callMutation((cb) => host.fs.rename("/a.txt", "/b.txt", cb));

    TestValidator.predicate("source removed", host.exists("/a.txt") === false);
    TestValidator.predicate("destination created", host.exists("/b.txt"));
    TestValidator.equals(
      "bytes preserved",
      host.readFileText("/b.txt"),
      "hello",
    );
  };
