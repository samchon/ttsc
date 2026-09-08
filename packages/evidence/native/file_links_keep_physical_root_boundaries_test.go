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
 */
func TestFileLinksKeepPhysicalRootBoundaries(t *testing.T) {
  fixture := newFileLinkFixture(t, map[string]string{"api/value.ts": "export const value = 1;", "outside/value.ts": "export const value = 2;", "review.md": "## Review\n<!-- @link api/value.ts#value Reads the value. -->\n"}, `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":[{"type":"typescript","root":"api","files":["value.ts"],"symbol":"property"},{"type":"typescript","root":"linked","files":["value.ts"],"symbol":"property"}]}]}`)
  if err := linkDirectory(filepath.Join(fixture.root, "api"), filepath.Join(fixture.root, "linked")); err != nil {
    t.Fatal(err)
  }
  assertNoProblems(t, fixture.check())
  if err := linkDirectory(filepath.Join(fixture.root, "outside"), filepath.Join(fixture.root, "api/escape")); err != nil {
    t.Fatal(err)
  }
  fixture.write("api/value.ts", "export { value } from './escape/value';")
  assertProblemContains(t, fixture.check(), "re-export leaves the explicitly configured root")
}
