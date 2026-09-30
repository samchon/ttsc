package evidence

import "testing"

/**
 * Verifies a reviewed checklist demands a review of the exclusion as well.
 *
 * Verifying that a declaration does what an item describes and verifying that the item does not apply here are opposite questions, and a checklist is where the second one is written most often, once per host that opts out. Both answers stand on the one host that gives them, so both owe their reviews beside them, each carrying the fingerprint the graph asks for its item; a checklist acknowledgement never comes from an exclusion ledger.
 *
 *  1. Require reviews on a checklist and answer one item by citation and one by exclusion on one host.
 *  2. Assert each tag is reported unreviewed and the graph names a fingerprint for its item.
 *  3. Write both reviews with the fingerprints the graph asks for and assert the claim passes.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a reviewed checklist demands a review of the exclusion as well. The original assertions check write both reviews with the fingerprints the graph asks for and assert the claim passes.
 * @evidence contracts/testing.md#independent-expectations Require reviews on a checklist and answer one item by citation and one by exclusion on one host. Assert each tag is reported unreviewed and the graph names a fingerprint for its item. Literal coverage and review-state assertions follow the authored item/host contract. Fingerprints obtained from the rule seed accepted review input; this is a state-transition oracle, not an independent verification of the hash algorithm.
 * @evidence contracts/testing.md#distinguishing-cases Require reviews on a checklist and answer one item by citation and one by exclusion on one host. Assert each tag is reported unreviewed and the graph names a fingerprint for its item. Write both reviews with the fingerprints the graph asks for and assert the claim passes. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestChecklistDemandsAReviewOfAnExclusionToo is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestChecklistDemandsAReviewOfAnExclusionToo(t *testing.T) {
  config := `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/rules.md"],
      "symbol":"h2",
      "checklist":true,
      "requireReview":true
    }
  }]}`
  // The reviews are omitted entirely in the probing pass rather than written
  // with an empty token, because the shared fingerprint reader recognizes
  // `Unreviewed @<tag>` for either kind but only `Unfingerprinted
  // @evidenceReview`, so a blank exclusion review would report no expected
  // value and the case would silently probe the citation alone.
  build := func(reviews string) map[string]string {
    return map[string]string{
      "docs/rules.md": checklistDocument,
      "src/mixed.ts": `/**
 * @evidence docs/rules.md#no-hardcoding The general logic decides.
 * @evidenceExclude docs/rules.md#no-whack-a-mole This helper has one case.
` + reviews + ` */
export function mixed(): void {}
`,
    }
  }
  unreviewed := runIndexRule(t, build(""), config)
  assertProblemContains(t, unreviewed, "Unreviewed @evidence for 'docs/rules.md#no-hardcoding'")
  assertProblemContains(t, unreviewed, "Unreviewed @evidenceExclude for 'docs/rules.md#no-whack-a-mole'")

  expected := everyExpectedFingerprint(t, build(""), config)
  for _, target := range []string{"docs/rules.md#no-hardcoding", "docs/rules.md#no-whack-a-mole"} {
    if expected[target] == "" {
      t.Fatalf("both tags must owe a fingerprint; %s did not: %v", target, expected)
    }
  }
  assertNoProblems(t, runIndexRule(t, build(
    ` * @evidenceReview docs/rules.md#no-hardcoding #`+expected["docs/rules.md#no-hardcoding"]+` Read the rule against this module.
 * @evidenceExcludeReview docs/rules.md#no-whack-a-mole #`+expected["docs/rules.md#no-whack-a-mole"]+` Confirmed the single code path.
`), config))
}
