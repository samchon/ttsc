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
