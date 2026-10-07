import { TestValidator } from "@nestia/e2e";
import { createMemFS } from "@ttsc/wasm";

import { callMutation, readdir } from "../../internal/callbackFs";

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
 * 3. Repeat with a nonempty directory alias and assert bytes and child names
 *    remain intact.
 *
 * @evidence contracts/testing.md#behavioral-verification createMemFS.fs.rename accepts two spellings of the same normalized file or nonempty directory without deleting nodes or changing bytes and child names. Presence, literal text and listings detect destructive delete/reinsert handling.
 * @evidence contracts/testing.md#independent-expectations POSIX same-path rename is successful without mutation. Authored keep.txt/./keep.txt and dir/dir/./ identify the same respective names, and independently seeded same/CHILD bytes and child.txt must remain.
 * @evidence contracts/testing.md#distinguishing-cases Non-normalized file and nonempty directory destination aliases exercise both node kinds at the identity boundary. The file-move sibling verifies changed names and the invalid-target sibling verifies rejected moves.
 * @evidence contracts/testing.md#execution-ownership test_memfs_rename_onto_self_is_noop directly awaits fs.rename through callMutation over one createMemFS host and owns exists/readFileText/readdir assertions. The source-unit runner discovers this entry for both normalized node-kind populations.
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
  host.writeFile("/dir/child.txt", "CHILD");
  await callMutation((cb) => host.fs.rename("/dir", "/dir/./", cb));
  TestValidator.equals(
    "same-directory rename preserves subtree and index",
    {
      children: await readdir(host.fs, "/dir"),
      text: host.readFileText("/dir/child.txt"),
    },
    { children: ["child.txt"], text: "CHILD" },
  );
};
