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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a healthy empty population leaves every checklist host passing. The original assertions check assert the empty population is the only diagnostic and the host is not judged.
 * @evidence contracts/testing.md#independent-expectations No policy judges an empty population any more; the materializer names it once and nothing derives a per-host finding beneath it. A checklist reaches that outcome through its own host loop rather than the shared one, so the case is asserted here separately. It once stood as the counter-example to `singleEvidencePerSymbol`, which kept judging an empty population on the argument that a host still owed the one unit it could not find — that exception is gone and the two now agree. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Select a document containing no H2 section. Run a checklist reference over it with one selected host. Assert the empty population is the only diagnostic and the host is not judged. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestChecklistPassesAgainstAHealthyEmptyPopulation is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
