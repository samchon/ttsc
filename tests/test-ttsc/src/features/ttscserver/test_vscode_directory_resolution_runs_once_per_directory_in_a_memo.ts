import assert from "node:assert/strict";

import { resolveWithDirectoryMemo } from "../../../../../packages/vscode/src/resolveWithDirectoryMemo";

/**
 * Verifies the per-reconciliation memo resolves each directory once however
 * many documents ask for it, including when the answer is undefined, and keeps
 * different directories apart.
 *
 * Every open document in a directory resolves to the same project, so a
 * reconciliation that repeated the resolution for each document would redo the
 * same filesystem discovery once per document. An undefined answer (a directory
 * with no usable project) is memoized as well, and a fresh memo for the next
 * reconciliation rediscovers the project from disk.
 *
 * 1. Resolve twelve documents of one directory through one memo and count the
 *    resolver calls.
 * 2. Resolve a directory whose answer is undefined repeatedly.
 * 3. Resolve a second directory in the same memo, then use a new memo.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls resolveWithDirectoryMemo with a counting resolver over many repeated keys and asserts the number of resolver invocations and the returned value each time, so a memo that re-resolved, or dropped an undefined answer, fails the count.
 * @evidence contracts/testing.md#independent-expectations The expected call counts (1, 1, 1 and 1 again after a fresh memo) follow from the documented once-per-key rule and the authored number of documents, not from the memo's code; the returned values are authored literals.
 * @evidence contracts/testing.md#distinguishing-cases Twelve calls for one directory against one resolution, a directory resolving to undefined against one resolving to a value, two directories in one memo, and a new memo for a later reconciliation each change the expected count.
 * @evidence contracts/testing.md#execution-ownership Pure unit over the extracted memo helper with authored closures in the test-ttsc runner; no VS Code host, workspace or filesystem is touched. That the extension builds launch options only when a client starts is not exercised here.
 */
export function test_vscode_directory_resolution_runs_once_per_directory_in_a_memo(): void {
  const memo = new Map<string, string | undefined>();
  let calls = 0;
  const project = () => {
    ++calls;
    return "project-a";
  };
  for (let document = 0; document < 12; ++document)
    assert.equal(
      resolveWithDirectoryMemo("/work/a", memo, project),
      "project-a",
    );
  assert.equal(calls, 1, "twelve documents of one directory resolve once");

  let missing = 0;
  const none = () => {
    ++missing;
    return undefined;
  };
  for (let document = 0; document < 5; ++document)
    assert.equal(
      resolveWithDirectoryMemo("/work/empty", memo, none),
      undefined,
    );
  assert.equal(missing, 1, "an undefined answer is memoized too");

  assert.equal(
    resolveWithDirectoryMemo("/work/b", memo, () => {
      ++calls;
      return "project-b";
    }),
    "project-b",
  );
  assert.equal(calls, 2, "another directory resolves on its own");
  assert.equal(
    resolveWithDirectoryMemo("/work/a", memo, project),
    "project-a",
    "an earlier directory still answers from the memo",
  );
  assert.equal(calls, 2);

  assert.equal(
    resolveWithDirectoryMemo("/work/a", new Map(), project),
    "project-a",
  );
  assert.equal(calls, 3, "a new reconciliation rediscovers from scratch");
}
