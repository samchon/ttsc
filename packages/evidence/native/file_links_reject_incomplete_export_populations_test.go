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
 *
 * @evidence contracts/testing.md#behavioral-verification newFileLinkFixture builds api/index.ts as `export { value, missing } from './value'` over a module exporting only `value`, with a link `api/index.ts#value`; the check must contain `no public export named 'missing'` and no `Missing acknowledgement`, and after the index is rewritten to export only `value` the check must be clean.
 * @evidence contracts/testing.md#independent-expectations The expectations are authored from the population contract: a barrel naming a nonexistent export makes the rooted population incomplete, so the cause is reported and partial coverage is not judged; removing the bad name restores a complete graph.
 * @evidence contracts/testing.md#distinguishing-cases A valid sibling export beside a missing one, which must not let the population count as healthy; the same files after the repair are the clean control.
 * @evidence contracts/testing.md#execution-ownership TestFileLinksRejectIncompleteExportPopulations is a Go unit entry in the native test process; it drives graphRule.Check through newFileLinkFixture over real temp files, with no consumer install or product host.
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
