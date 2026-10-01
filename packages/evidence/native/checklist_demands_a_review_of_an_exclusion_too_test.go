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
 * @evidence contracts/testing.md#behavioral-verification With a checklist reference that sets requireReview, runIndexRule is run over one function host that cites `no-hardcoding` and excludes `no-whack-a-mole`, and must report `Unreviewed @evidence for 'docs/rules.md#no-hardcoding'` and `Unreviewed @evidenceExclude for 'docs/rules.md#no-whack-a-mole'`; everyExpectedFingerprint must name a fingerprint for both targets, and writing an @evidenceReview and an @evidenceExcludeReview carrying them must make the graph silent.
 * @evidence contracts/testing.md#independent-expectations The unreviewed and clean outcomes are authored from the checklist review contract; the fingerprint values are read from the graph's own request, so this checks the accepted-review state transition rather than the hash algorithm.
 * @evidence contracts/testing.md#distinguishing-cases The probing pass deliberately omits both reviews, since a blank exclusion review would not be asked for a fingerprint and the case would silently probe the citation alone; the test requires a fingerprint for each of the two tag kinds before writing the reviews.
 * @evidence contracts/testing.md#execution-ownership TestChecklistDemandsAReviewOfAnExclusionToo is a Go unit entry in the native test process; it calls the graph rule through runIndexRule and everyExpectedFingerprint over temp fixture files, with no consumer install or product host.
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
