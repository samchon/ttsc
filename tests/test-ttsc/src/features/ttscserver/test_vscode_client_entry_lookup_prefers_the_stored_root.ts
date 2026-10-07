import assert from "node:assert/strict";

import { findClientEntryByRoot } from "../../../../../packages/vscode/src/findClientEntryByRoot";

/**
 * Verifies the VS Code client lookup returns the entry that stores the given
 * root verbatim, falls back to the recomputed key, and reports a miss as
 * undefined.
 *
 * A client's key is observed from the filesystem when the entry is created and
 * can differ when computed again, for example after the directory behind a link
 * is removed. Looking up only by the recomputed key would then find nothing and
 * a stop request would silently leave the client running. The stored root is
 * the stable spelling, so it is matched first.
 *
 * 1. Store an entry under one key while the recomputed key of its root is another,
 *    and look it up by its root.
 * 2. Look up a root that no entry stores but whose recomputed key is indexed.
 * 3. Look up a root with neither a stored match nor an indexed key.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls findClientEntryByRoot with entries, a key index and a key function and asserts the identical entry object returned in the stored-root, fallback and miss cases, so a lookup that used only the recomputed key fails the first assertion.
 * @evidence contracts/testing.md#independent-expectations The expected entries are the authored objects themselves and the roots and keys are authored strings; the contract (stored spelling first, recomputed key as fallback, otherwise nothing) is taken from the function's documented behavior, not from its code.
 * @evidence contracts/testing.md#distinguishing-cases A root whose recomputed key points at another entry (the stored one must still win), a root found only by key, and a root found by neither separate the three outcomes; two entries with different roots show the exact-spelling match picks the right one.
 * @evidence contracts/testing.md#execution-ownership Pure unit over the extracted lookup with authored data in the test-ttsc runner; no VS Code host, client or process runs. The extension's use of the lookup when it stops a client is not exercised here.
 */
export function test_vscode_client_entry_lookup_prefers_the_stored_root(): void {
  const first = { id: "key-of-first", root: "/work/linked-a" };
  const second = { id: "key-of-second", root: "/work/other" };
  const byKey = new Map([
    [first.id, first],
    [second.id, second],
  ]);
  const entries = [first, second];

  assert.equal(
    findClientEntryByRoot(entries, byKey, first.root, () => second.id),
    first,
    "the stored root wins even when its recomputed key names another client",
  );
  assert.equal(
    findClientEntryByRoot(entries, byKey, second.root, () => "key-that-moved"),
    second,
    "the stored root is found when its recomputed key no longer indexes anything",
  );
  assert.equal(
    findClientEntryByRoot(
      entries,
      byKey,
      "/work/alias-of-other",
      () => second.id,
    ),
    second,
    "a root no entry stores falls back to the recomputed key",
  );
  assert.equal(
    findClientEntryByRoot(entries, byKey, "/work/unknown", () => "no-such-key"),
    undefined,
    "a root with no stored match and no indexed key finds nothing",
  );
  assert.equal(
    findClientEntryByRoot([], new Map(), first.root, () => first.id),
    undefined,
  );
}
