package evidence

import (
  "testing"
)

/**
 * Verifies a package reference governs no file of the project.
 *
 * A package reference reads an installed package from disk, and its globs are
 * written as a consumer thinks of that package, so they resolve against the
 * package root. Matched against a project-relative path instead, `**` claimed
 * every file the project has — `node_modules` included, which is the one the
 * confinement exists to release, and the one a consumer cannot edit.
 *
 *  1. Declare a package reference whose glob would match everything.
 *  2. Write an unreadable tag in a vendored file.
 *  3. Assert it is not reported.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a function claim over src/views/** and a TypeScript package reference `@org/api` with files ["**\/*.ts"], over a fixture that has node_modules/@org/api (manifest plus declared `get`), a stray `// @evidence get` line comment in node_modules/vendor/index.ts, and src/views/detail.ts; assertReported requires exactly one diagnostic, `Missing acknowledgement for 'get'`.
 * @evidence contracts/testing.md#independent-expectations Package reference globs are resolved against the package root, so the recursive glob must not govern project files such as node_modules/vendor; the still-owed `get` acknowledgement proves the graph was active, which prevents a deactivated graph from satisfying the absence of an unreadable-tag diagnostic.
 * @evidence contracts/testing.md#distinguishing-cases The vendored file holds an unreadable tag that would be reported if the glob governed project files, while the declaration owed by the package stays reported; exactly one diagnostic separates the two outcomes. A project-relative glob under a non-package reference is not covered here.
 * @evidence contracts/testing.md#execution-ownership TestAPackageReferenceGovernsNoProjectFile is a Go unit entry in the native test process; runIndexRule writes the fixture files to a temp directory and calls the graph rule directly, resolving the package from disk with no consumer install or product host.
 */
func TestAPackageReferenceGovernsNoProjectFile(t *testing.T) {
  assertReported(t, runIndexRule(t, map[string]string{
    "node_modules/@org/api/package.json": packageManifest,
    "node_modules/@org/api/lib/index.d.ts": `
export declare function get(): void;
`,
    "node_modules/vendor/index.ts": `// @evidence get A tag in a file the consumer did not write.
export const other = 2;
`,
    "src/views/detail.ts": "export function detail(): void {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/views/**"],
    "symbol":"function",
    "reference":{"type":"typescript","package":"@org/api","files":["**/*.ts"],"symbol":"function"}
  }]}`), "Missing acknowledgement for 'get'")
}
