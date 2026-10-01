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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule over a function host that cites `no-hardcoding` and excludes `no-whack-a-mole` against a two-item Markdown checklist; the default reference must produce no diagnostics, and the same source under `noEvidenceExclude` must report `Forbidden @evidenceExclude for 'docs/rules.md#no-whack-a-mole'`, `has not acknowledged 1 of 2 checklist item(s): 'docs/rules.md#no-whack-a-mole'` and `this reference forbids @evidenceExclude`.
 * @evidence contracts/testing.md#independent-expectations The expectations are authored from the checklist contract that an exclusion is an honest answer for an item that does not apply unless the reference forbids exclusions, in which case the item is owed again; the document, citation and exclusion are literal fixtures.
 * @evidence contracts/testing.md#distinguishing-cases The same source is judged under two reference policies, so the accepted and refused outcomes differ only by the noEvidenceExclude option; a plain uncited item and a citation-only host are owned by sibling entries.
 * @evidence contracts/testing.md#execution-ownership TestChecklistAcceptsAnExclusionUnlessTheReferenceRefusesOne is a Go unit entry in the native test process; it calls the graph rule twice through runIndexRule over temp fixture files, with no consumer install or product host.
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
