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
 */
export const test_memfs_rename_file_preserves_bytes = async (): Promise<void> => {
  const host = createMemFS();
  host.writeFile("/a.txt", "hello");

  await callMutation((cb) => host.fs.rename("/a.txt", "/b.txt", cb));

  TestValidator.predicate("source removed", host.exists("/a.txt") === false);
  TestValidator.predicate("destination created", host.exists("/b.txt"));
  TestValidator.equals("bytes preserved", host.readFileText("/b.txt"), "hello");
};
