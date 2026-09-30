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
 *
 * @evidence contracts/testing.md#behavioral-verification createMemFS.fs.rename accepts two spellings of the same normalized file path without deleting the node or changing its bytes. Presence and literal same text detect destructive delete/reinsert handling.
 * @evidence contracts/testing.md#independent-expectations POSIX same-path rename is successful without mutation. Authored keep.txt and ./keep.txt identify the same normalized name, and independently seeded same bytes must remain.
 * @evidence contracts/testing.md#distinguishing-cases The non-normalized destination alias exercises the identity boundary rather than an ordinary move. The file-move sibling verifies changed names and the invalid-target sibling verifies rejected moves.
 * @evidence contracts/testing.md#execution-ownership test_memfs_rename_onto_self_is_noop directly awaits fs.rename through callMutation over one createMemFS host and owns exists/readFileText assertions. The source-unit runner discovers this one no-op entry.
 */
export const test_memfs_rename_onto_self_is_noop = async (): Promise<void> => {
  const host = createMemFS();
  host.writeFile("/keep.txt", "same");

  await callMutation((cb) => host.fs.rename("/keep.txt", "/./keep.txt", cb));

  TestValidator.predicate("file still present", host.exists("/keep.txt"));
  TestValidator.equals(
    "bytes untouched",
    host.readFileText("/keep.txt"),
    "same",
  );
};
