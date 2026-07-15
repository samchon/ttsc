import { TestValidator } from "@nestia/e2e";
import { createMemFS } from "@ttsc/wasm";

import { callMutation } from "../../internal/callbackFs";

/**
 * Verifies MemFS rename of a path onto itself is a success that changes
 * nothing.
 *
 * Boundary case for the move algorithm: `src === dest` must short-circuit
 * before the subtree-delete-then-reinsert logic runs, because that logic
 * deletes the source subtree first and would otherwise erase the node it is
 * supposed to keep. POSIX `rename(2)` defines same-path rename as a no-op
 * success.
 *
 * 1. Seed `/keep.txt` with "same".
 * 2. Rename `/keep.txt` onto itself (via a non-normalized alias `/./keep.txt`).
 * 3. Assert the callback succeeded and the file and its bytes still exist.
 */
export const test_memfs_rename_onto_self_is_noop = async (): Promise<void> => {
  const host = createMemFS();
  host.writeFile("/keep.txt", "same");

  await callMutation((cb) => host.fs.rename("/keep.txt", "/./keep.txt", cb));

  TestValidator.predicate("file still present", host.exists("/keep.txt"));
  TestValidator.equals("bytes untouched", host.readFileText("/keep.txt"), "same");
};
