import assert from "node:assert/strict";
import path from "node:path";

import type { FilesystemPathIdentityContext } from "../../../../../packages/ttsc/src/internal/pathIdentity/FilesystemPathIdentityContext";
import { createFilesystemPathIdentityContext } from "../../../../../packages/ttsc/src/internal/pathIdentity/createFilesystemPathIdentityContext";

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
 * 3. On Windows, assert slash-form and volume-root case aliases match native
 *    paths.
 * 4. Inject both Windows directory semantics and reject a case-distinct sibling.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual identity context on descendant/self/sibling and volume-root paths. Native Windows inputs vary slash spelling and volume-root case only; injected Windows authorities independently model insensitive and sensitive directory case differences.
 * @evidence contracts/testing.md#independent-expectations The expected booleans are authored from the containment rule (a directory contains itself and its descendants but not a sibling that merely shares a name prefix, and case-differing paths match only under an insensitive directory), not computed from the context; the injected realpath/caseSensitive stubs define the Windows volumes independently of the real filesystem.
 * @evidence contracts/testing.md#distinguishing-cases Descendant/self/volume-root and native Windows separator/root aliases contrast with sibling-prefix rejection. Injected insensitive directory aliases match; a case-distinct sensitive sibling does not. Native Windows rows run on Windows and injected authority rows run everywhere, without assuming a volume-wide directory case policy.
 * @evidence contracts/testing.md#execution-ownership Calls the authored identity context directly on native path inputs and supplied Windows authorities. Default resolution can observe existing ancestors and invoke the read-only Windows fsutil case query; no compiler, native build or ttsc host runs. The injected case authorities do not query the host's directory policy.
 */
export function test_filesystem_identity_within_matches_roots_and_slash_normalized_rootdirs() {
  const base = path.resolve(path.sep, "a", "b");
  assert.equal(isWithin(path.join(base, "c.ts"), base), true);
  assert.equal(isWithin(base, base), true);
  // Sibling sharing a name prefix must NOT match ("/a/bc" vs "/a/b").
  assert.equal(isWithin(`${base}c`, base), false);

  const root = path.parse(process.cwd()).root;
  assert.equal(isWithin(path.join(root, "anything.ts"), root), true);

  if (process.platform === "win32") {
    // Slash-form rootDir from the synthesized tsconfig vs native real path.
    const native = path.join(root, "a", "b", "c.ts");
    const slashParent = path.join(root, "a", "b").replaceAll("\\", "/");
    const slashRoot = root.replaceAll("\\", "/");
    const caseAliasedParent =
      slashRoot.toLowerCase() + slashParent.slice(slashRoot.length);
    assert.equal(isWithin(native, slashParent), true);
    assert.equal(isWithin(native, slashRoot), true);
    assert.equal(isWithin(native, caseAliasedParent), true);
    assert.equal(
      isWithin(path.join(root, "a", "bc", "d.ts"), slashParent),
      false,
    );
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
}

/** Whether `directory` contains `real`, through one identity context. */
const isWithin = (
  real: string,
  directory: string,
  identities: FilesystemPathIdentityContext = createFilesystemPathIdentityContext(
    { throwOnRealpathError: false },
  ),
): boolean => identities.isWithin(directory, real);
