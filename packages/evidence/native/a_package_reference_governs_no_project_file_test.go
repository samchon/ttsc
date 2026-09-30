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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule reports exactly the missing acknowledgement for get and no unreadable finding for the vendored project comment.
 * @evidence contracts/testing.md#independent-expectations Package reference globs are anchored to the fixture package, so its recursive TypeScript glob cannot govern project files under another vendor path. The authored public get declaration remains owed, which prevents a deactivated graph from satisfying absence of the stray diagnostic.
 * @evidence contracts/testing.md#distinguishing-cases An authored @org/api manifest and declaration establish the package target; node_modules/vendor/index.ts holds the stray comment and an active detail function claims the package reference. This is disk resolver semantics without installing a consumer.
 * @evidence contracts/testing.md#execution-ownership TestAPackageReferenceGovernsNoProjectFile is the Go unit entry discovered beside the native package. runIndexRule evaluates its source and configuration fixtures in the native test process; local loops retain their named subcases without a consumer install or product host.
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
