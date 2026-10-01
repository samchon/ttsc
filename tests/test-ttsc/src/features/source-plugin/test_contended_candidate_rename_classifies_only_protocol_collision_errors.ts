import assert from "node:assert/strict";
import { isContendedCandidateRename } from "../../../../../packages/ttsc/src/internal/isContendedCandidateRename";

/**
 * Writable-parent lock publication interprets these native collision errors
 * without re-reading a destination that a concurrent holder may already remove.
 * @evidence contracts/testing.md#behavioral-verification The authored shared lock classifier returns true for EEXIST, ENOTEMPTY, EACCES and EPERM and false for unrelated or absent errno values.
 * @evidence contracts/testing.md#independent-expectations A literal corpus enumerates the protocol's four allowed collision codes and neighboring I/O, missing-source and resource failures; expected booleans do not come from product computation or a snapshot.
 * @evidence contracts/testing.md#distinguishing-cases Every accepted code is exercised as an Error with rename metadata and as a plain errno record; EIO, ENOENT, ENOSPC, EBUSY, an empty code, an absent code and a plain Error must remain false.
 * @evidence contracts/testing.md#execution-ownership This named source unit imports only the actual authored classifier, invokes it directly and creates no native producer, process, consumer installation or foreign filesystem patch. The genuine lock-admission E2E separately owns both protocols' occupancy/release connection.
 */
export function test_contended_candidate_rename_classifies_only_protocol_collision_errors(): void {
  for (const code of ["EEXIST", "ENOTEMPTY", "EACCES", "EPERM"]) {
    assert.equal(isContendedCandidateRename(Object.assign(new Error("rename collision"), { code, syscall: "rename" })), true, code);
    assert.equal(isContendedCandidateRename({ code }), true, code);
  }
  for (const code of ["EIO", "ENOENT", "ENOSPC", "EBUSY", ""]) {
    assert.equal(isContendedCandidateRename({ code }), false, code);
  }
  assert.equal(isContendedCandidateRename({}), false);
  assert.equal(isContendedCandidateRename(new Error("unclassified")), false);
}
