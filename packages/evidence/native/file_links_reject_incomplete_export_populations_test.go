package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies missing named re-exports make a rooted population incomplete.
 *
 * A valid sibling export cannot justify declaring the whole source healthy.
 * The graph must name the missing export without deriving partial coverage.
 *
 * 1. Forward one real name and one missing name from a disk-only module.
 * 2. Assert the loader diagnostic and absence of derivative coverage findings.
 * 3. Repair the export and verify the citation succeeds.
 */
func TestFileLinksRejectIncompleteExportPopulations(t *testing.T) {
  fixture := newFileLinkFixture(t, map[string]string{"api/value.ts": "export const value = 1;", "api/index.ts": "export { value, missing } from './value';", "review.md": "## Review\n<!-- @link api/index.ts#value Reads the value. -->\n"}, `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","root":"api","files":["index.ts"],"symbol":"property"}}]}`)
  messages := fixture.check()
  assertProblemContains(t, messages, "no public export named 'missing'")
  if strings.Contains(strings.Join(messages, "\n"), "Missing acknowledgement") {
    t.Fatalf("partial coverage was judged: %v", messages)
  }
  fixture.write("api/index.ts", "export { value } from './value';")
  assertNoProblems(t, fixture.check())
}
