package evidence

import "testing"

/**
 * Verifies an exclusion answers a checklist item and obeys the refusing policy.
 *
 * A checklist item that does not apply to a host has one honest answer, and refusing it would leave the author only an untrue citation. The same reference under `noEvidenceExclude` must reverse that and leave the item owed, or the strict spelling would be indistinguishable from the ordinary one.
 *
 *  1. Cite one item and exclude the other from a single host.
 *  2. Assert the host passes.
 *  3. Re-run the same source under `noEvidenceExclude` and assert the exclusion is forbidden and its item still owed.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies an exclusion answers a checklist item and obeys the refusing policy. The original assertions check re-run the same source under `noEvidenceExclude` and assert the exclusion is forbidden and its item still owed.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A checklist item that does not apply to a host has one honest answer, and refusing it would leave the author only an untrue citation. The same reference under `noEvidenceExclude` must reverse that and leave the item owed, or the strict spelling would be indistinguishable from the ordinary one. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Cite one item and exclude the other from a single host. Assert the host passes. Re-run the same source under `noEvidenceExclude` and assert the exclusion is forbidden and its item still owed. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestChecklistAcceptsAnExclusionUnlessTheReferenceRefusesOne is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestChecklistAcceptsAnExclusionUnlessTheReferenceRefusesOne(t *testing.T) {
  files := map[string]string{
    "docs/rules.md": checklistDocument,
    "src/mixed.ts": `/**
 * @evidence docs/rules.md#no-hardcoding The general logic decides.
 * @evidenceExclude docs/rules.md#no-whack-a-mole This helper has one case.
 */
export function mixed(): void {}
`,
  }
  assertNoProblems(t, runIndexRule(t, files, checklistConfig))

  strict := runIndexRule(t, files, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/rules.md"],
      "symbol":"h2",
      "checklist":true,
      "noEvidenceExclude":true
    }
  }]}`)
  assertProblemContains(t, strict, "Forbidden @evidenceExclude for 'docs/rules.md#no-whack-a-mole'")
  assertProblemContains(t, strict, "has not acknowledged 1 of 2 checklist item(s): 'docs/rules.md#no-whack-a-mole'")
  assertProblemContains(t, strict, "this reference forbids @evidenceExclude")
}
