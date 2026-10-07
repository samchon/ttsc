package evidence

import (
  "path/filepath"
  "testing"
)

/**
 * Verifies linked roots preserve identity while nested escapes remain forbidden.
 *
 * An explicitly linked root is a selected directory. A nested link cannot
 * silently add an unconfigured implementation or duplicate an existing unit.
 *
 * 1. Select one physical module through its directory and an explicit root link.
 * 2. Assert a single citation acknowledges both populations.
 * 3. Add a nested link outside the root and verify traversal fails.
 *
 * @evidence contracts/testing.md#behavioral-verification newFileLinkFixture builds two references over the same module, root `api` and root `linked` (a directory symlink to api), and a link `api/value.ts#value`; the first check must be clean, and after adding a symlink api/escape to a sibling outside directory and rewriting api/value.ts to re-export from it the check must report `re-export leaves the explicitly configured root`.
 * @evidence contracts/testing.md#independent-expectations The expectations are authored from the root contract: two explicit roots reaching one physical file owe one obligation acknowledged by one citation, while a nested link that escapes the root is a boundary violation.
 * @evidence contracts/testing.md#distinguishing-cases The duplicate-root arm (clean) against the nested-escape arm (must fail) on the same fixture; the second arm uses a value in the outside directory that differs from the inside one.
 * @evidence contracts/testing.md#execution-ownership TestFileLinksKeepPhysicalRootBoundaries is a Go unit entry in the native test process; it drives graphRule.Check through newFileLinkFixture over real temp files and real directory symbolic links, with no consumer install or product host, and fails (not skips) if the platform refuses to create a link.
 */
func TestFileLinksKeepPhysicalRootBoundaries(t *testing.T) {
  fixture := newFileLinkFixture(t, map[string]string{"api/value.ts": "export const value = 1;", "outside/value.ts": "export const value = 2;", "review.md": "## Review\n<!-- @link api/value.ts#value Reads the value. -->\n"}, `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":[{"type":"typescript","root":"api","files":["value.ts"],"symbol":"property"},{"type":"typescript","root":"linked","files":["value.ts"],"symbol":"property"}]}]}`)
  if err := linkDirectory(t, filepath.Join(fixture.root, "api"), filepath.Join(fixture.root, "linked")); err != nil {
    t.Fatal(err)
  }
  assertNoProblems(t, fixture.check())
  if err := linkDirectory(t, filepath.Join(fixture.root, "outside"), filepath.Join(fixture.root, "api/escape")); err != nil {
    t.Fatal(err)
  }
  fixture.write("api/value.ts", "export { value } from './escape/value';")
  assertProblemContains(t, fixture.check(), "re-export leaves the explicitly configured root")
}
