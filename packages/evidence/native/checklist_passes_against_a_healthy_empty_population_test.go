package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a healthy empty population leaves every checklist host passing.
 *
 * No policy judges an empty population any more; the materializer names it once and nothing derives a per-host finding beneath it. A checklist reaches that outcome through its own host loop rather than the shared one, so the case is asserted here separately. It once stood as the counter-example to `singleEvidencePerSymbol`, which kept judging an empty population on the argument that a host still owed the one unit it could not find — that exception is gone and the two now agree.
 *
 *  1. Select a document containing no H2 section.
 *  2. Run a checklist reference over it with one selected host.
 *  3. Assert the empty population is the only diagnostic and the host is not judged.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a function checklist over `docs/rules.md` containing only prose (no h2) and one function host; the test requires exactly one diagnostic, containing `found no selected evidence units (h2)`.
 * @evidence contracts/testing.md#independent-expectations The expected single message is authored: an empty healthy population is named once by the materializer and the checklist host loop must not derive a per-host finding beneath it.
 * @evidence contracts/testing.md#distinguishing-cases Empty item population with one selected host: a checklist loop that judged the host against zero items would report nothing or something per host, and the exact count of one with the empty-population wording excludes both.
 * @evidence contracts/testing.md#execution-ownership TestChecklistPassesAgainstAHealthyEmptyPopulation is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestChecklistPassesAgainstAHealthyEmptyPopulation(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/rules.md": "Plain prose with no selected heading.\n",
    "src/quiet.ts":  "export function quiet(): void {}\n",
  }, checklistConfig)
  if len(messages) != 1 {
    t.Fatalf("expected only the empty-population diagnostic, got:\n%s", strings.Join(messages, "\n"))
  }
  assertProblemContains(t, messages, "found no selected evidence units (h2)")
}
