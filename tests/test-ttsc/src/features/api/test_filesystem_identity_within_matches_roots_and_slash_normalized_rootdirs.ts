import assert from "node:assert/strict";
import path from "node:path";

import type { FilesystemPathIdentityContext } from "../../../../../packages/ttsc/lib/internal/pathIdentity/FilesystemPathIdentityContext.js";
import { createFilesystemPathIdentityContext } from "../../../../../packages/ttsc/lib/internal/pathIdentity/createFilesystemPathIdentityContext.js";

/**
 * Verifies filesystem-identity containment matches root directories and
 * slash-normalized `rootDir`s.
 *
 * Ttsx asks this predicate where a directory contains a file: the single-root
 * build widens `rootDir` to the nearest ancestor holding both the project and
 * the root, and the watch rules bound project inputs by it. A `rootDir` arrives
 * slash-normalized from a synthesized tsconfig (`C:/` on Windows) while real
 * paths are native, and a volume root must match without producing a `//`
 * prefix (#304). A raw string comparison silently answers "outside".
 *
 * 1. Assert containment, identity, and the sibling-prefix counter-example with
 *    native separators.
 * 2. Assert a volume-root directory contains everything on its volume.
 * 3. On Windows, assert slash-form and differently-cased directories still match
 *    native real paths.
 * 4. Inject both Windows directory semantics and reject a case-distinct sibling.
 */
export const test_filesystem_identity_within_matches_roots_and_slash_normalized_rootdirs =
  () => {
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

    const missing = (): never => {
      throw Object.assign(new Error("missing"), { code: "ENOENT" });
    };
    const windows = createFilesystemPathIdentityContext({
      platform: "win32",
      caseSensitive: (directory) =>
        directory.toLowerCase().startsWith("c:\\sensitive"),
      realpath: (location) => {
        const resolved = path.win32.resolve(location);
        const folded = resolved.toLowerCase();
        if (folded === "c:\\ordinary") return "C:\\Ordinary";
        if (folded === "c:\\ordinary\\project") return "C:\\Ordinary\\Project";
        if (resolved === "C:\\Sensitive") return resolved;
        if (resolved === "C:\\Sensitive\\Project") return resolved;
        if (resolved === "C:\\Sensitive\\project") return resolved;
        return missing();
      },
    });
    assert.equal(
      isWithin(
        "c:\\ordinary\\PROJECT\\src\\main.ts",
        "C:\\Ordinary\\Project",
        windows,
      ),
      true,
    );
    assert.equal(
      isWithin(
        "C:\\Sensitive\\Project\\src\\main.ts",
        "C:\\Sensitive\\Project",
        windows,
      ),
      true,
    );
    assert.equal(
      isWithin(
        "C:\\Sensitive\\project\\src\\main.ts",
        "C:\\Sensitive\\Project",
        windows,
      ),
      false,
    );
  };

/** Whether `directory` contains `real`, through one identity context. */
const isWithin = (
  real: string,
  directory: string,
  identities: FilesystemPathIdentityContext = createFilesystemPathIdentityContext(
    { throwOnRealpathError: false },
  ),
): boolean => identities.isWithin(directory, real);
