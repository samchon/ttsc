import assert from "node:assert/strict";
import path from "node:path";

import { isWithin } from "../../../../../packages/ttsc/lib/launcher/internal/runtimeHooks.js";

/**
 * Verifies `isWithin` matches root directories and slash-normalized `rootDir`s.
 *
 * The runtime hooks bound emit serving by the manifest `rootDir`, which the
 * loader tsconfig emits slash-normalized (`C:/` on Windows) while `real` paths
 * are native — and a volume root must match without producing a `//` prefix
 * (#304). A raw string comparison silently serves nothing, degrading every
 * lookup to the fallback paths.
 *
 * 1. Assert containment, identity, and the sibling-prefix counter-example with
 *    native separators.
 * 2. Assert a volume-root directory contains everything on its volume.
 * 3. On Windows, assert slash-form and differently-cased directories still match
 *    native real paths.
 */
export const test_iswithin_matches_roots_and_slash_normalized_rootdirs = () => {
  const base = path.resolve(path.sep, "a", "b");
  assert.equal(isWithin(path.join(base, "c.ts"), base), true);
  assert.equal(isWithin(base, base), true);
  // Sibling sharing a name prefix must NOT match ("/a/bc" vs "/a/b").
  assert.equal(isWithin(`${base}c`, base), false);

  const root = path.parse(process.cwd()).root;
  assert.equal(isWithin(path.join(root, "anything.ts"), root), true);

  if (process.platform === "win32") {
    // Slash-form rootDir from the synthesized tsconfig vs native real path.
    assert.equal(isWithin("C:\\a\\b\\c.ts", "C:/a/b"), true);
    assert.equal(isWithin("C:\\a\\b\\c.ts", "C:/"), true);
    // Drive-letter and path casing differ between a lowercase TEMP env and
    // canonical real paths.
    assert.equal(isWithin("C:\\A\\B\\c.ts", "c:/a/b"), true);
    assert.equal(isWithin("C:\\a\\bc\\d.ts", "C:/a/b"), false);
  }
};
