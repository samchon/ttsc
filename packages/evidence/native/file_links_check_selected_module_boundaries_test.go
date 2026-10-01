package evidence

import (
  "os"
  "path/filepath"
  "testing"
)

/**
 * Verifies root containment judges the selected module, not an extensionless path.
 *
 * A same-named directory can exist beside value.ts and is not its identity.
 * Resolving a directory link before module substitution rejects a valid file.
 *
 * 1. Re-export value.ts beside a value/ directory linked outside the root.
 * 2. Verify the file wins and its citation succeeds.
 * 3. Remove that candidate and verify a directory entry outside the root fails.
 *
 * @evidence contracts/testing.md#behavioral-verification newFileLinkFixture builds api/index.ts re-exporting `./value` with api/value.ts present, and an api/value directory symlinked to the outside directory, under a reference with root `api`; the first check must report nothing, and after api/value.ts is removed the check must report `re-export leaves the explicitly configured root`.
 * @evidence contracts/testing.md#independent-expectations The expectations are authored from the boundary contract: containment is judged on the selected module (value.ts wins over the same-named linked directory), and once the file is gone the only candidate is the directory outside the root, which must fail with the named reason.
 * @evidence contracts/testing.md#distinguishing-cases The same barrel before and after deleting the file candidate: the first run rejects a resolver that checks the extensionless path against the root first, the second rejects one that follows the linked directory silently.
 * @evidence contracts/testing.md#execution-ownership TestFileLinksCheckSelectedModuleBoundaries is a Go unit entry in the native test process; it drives graphRule.Check through newFileLinkFixture over real temp files and a real directory symbolic link, with no consumer install or product host, and fails (not skips) if the platform refuses to create the link.
 */
func TestFileLinksCheckSelectedModuleBoundaries(t *testing.T) {
  fixture := newFileLinkFixture(t, map[string]string{"api/index.ts": "export { value } from './value';", "api/value.ts": "export const value = 1;", "outside/index.ts": "export const value = 2;", "review.md": "## Review\n<!-- @link api/index.ts#value Reads the value. -->\n"}, `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","root":"api","files":["index.ts"],"symbol":"property"}}]}`)
  if err := linkDirectory(filepath.Join(fixture.root, "outside"), filepath.Join(fixture.root, "api/value")); err != nil {
    t.Fatal(err)
  }
  assertNoProblems(t, fixture.check())
  if err := os.Remove(filepath.Join(fixture.root, "api/value.ts")); err != nil {
    t.Fatal(err)
  }
  assertProblemContains(t, fixture.check(), "re-export leaves the explicitly configured root")
}
