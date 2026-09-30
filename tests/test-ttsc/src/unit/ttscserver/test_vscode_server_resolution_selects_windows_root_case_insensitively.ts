import * as mod from "../../../../../packages/vscode/src/serverResolution";
import assert from "node:assert/strict";
import path from "node:path";

/**
 * Verifies VS Code server root selection is case-insensitive on Windows paths.
 *
 * VS Code can report workspace roots and document paths with different drive or
 * segment casing. Command routing should still choose the deepest matching
 * language client on Windows while preserving normal case-sensitive behavior on
 * POSIX platforms.
 *
 * 1. Import the pure path-selection helper.
 * 2. Select a client root for a differently-cased Windows document path.
 * 3. Assert the nested root is selected.
 *
 * @evidence contracts/testing.md#behavioral-verification selectDeepestRootForPath selects the deepest Windows client despite casing aliases.
 * @evidence contracts/testing.md#independent-expectations An independently authored directory map supplies canonical parent/nested roots and ordinary directory case authority; the literal nested client is the expected deepest owner.
 * @evidence contracts/testing.md#distinguishing-cases A mixed-case Windows file is contained by both declared ordinary parent and nested clients and must select the nested owner; a file outside the declared root has no owner, while sensitive-root counterexamples belong to the sibling identity unit.
 * @evidence contracts/testing.md#execution-ownership This named source unit invokes the real selector and identity resolver with supported directory observation inputs in process; it neither assumes Windows casing from the CI host nor starts a language client or native host.
 */
export function test_vscode_server_resolution_selects_windows_root_case_insensitively() {
  const ordinaryDirectories = new Map([
    ["c:\\repo", "C:\\Repo"],
    ["c:\\repo\\packages", "C:\\Repo\\Packages"],
    ["c:\\repo\\packages\\demo", "C:\\Repo\\Packages\\Demo"],
    ["c:\\repo\\packages\\demo\\src", "C:\\Repo\\Packages\\Demo\\src"],
  ]);
  const identities = mod.createServerRootPathIdentityContext("win32", {
    caseSensitive: () => false,
    realpath: (location) => {
      const directory = ordinaryDirectories.get(path.win32.normalize(location).toLowerCase());
      if (directory !== undefined) return directory;
      throw Object.assign(new Error("missing"), { code: "ENOENT" });
    },
  });
  const observed = (() => {
    return mod.selectDeepestRootForPath(
      "c:\\repo\\packages\\demo\\src\\main.ts",
      ["C:\\Repo", "C:\\Repo\\Packages\\Demo"],
      "win32",
      identities,
    );
  
  })();
  assert.equal(observed, "C:\\Repo\\Packages\\Demo");
  assert.equal(mod.selectDeepestRootForPath("C:\\Other\\main.ts", ["C:\\Repo"], "win32", identities), undefined);
}
