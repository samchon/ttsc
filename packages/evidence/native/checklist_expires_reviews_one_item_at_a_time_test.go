package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a reviewed checklist expires one item's answers and leaves the rest green.
 *
 * Per-item expiry is the property a checklist is documented to buy, and it exists only because the aggregate citation is refused: one document-wide tag would carry one fingerprint for the whole document and every edit would expire everything. Editing one item must therefore reach that item's reviews on every host and no others.
 *
 *  1. Answer a two-item checklist from two hosts, each review carrying the fingerprint the graph asks for.
 *  2. Assert the reviewed checklist passes.
 *  3. Edit the body of one item and assert both hosts go stale on that item alone.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a reviewed checklist expires one item's answers and leaves the rest green. The original assertions check edit the body of one item and assert both hosts go stale on that item alone.
 * @evidence contracts/testing.md#independent-expectations Answer a two-item checklist from two hosts, each review carrying the fingerprint the graph asks for. Assert the reviewed checklist passes. Literal coverage and review-state assertions follow the authored item/host contract. Fingerprints obtained from the rule seed accepted review input; this is a state-transition oracle, not an independent verification of the hash algorithm.
 * @evidence contracts/testing.md#distinguishing-cases Answer a two-item checklist from two hosts, each review carrying the fingerprint the graph asks for. Assert the reviewed checklist passes. Edit the body of one item and assert both hosts go stale on that item alone. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestChecklistExpiresReviewsOneItemAtATime is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestChecklistExpiresReviewsOneItemAtATime(t *testing.T) {
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
  build := func(document string, first string, second string) map[string]string {
    return map[string]string{
      "docs/rules.md": document,
      "src/first.ts": `/**
 * @evidence docs/rules.md#no-hardcoding The general logic decides.
 * @evidenceReview docs/rules.md#no-hardcoding ` + first + ` Read the rule against this module.
 * @evidence docs/rules.md#no-whack-a-mole Every sibling case is covered.
 * @evidenceReview docs/rules.md#no-whack-a-mole ` + second + ` Read the rule against this module.
 */
export function first(): void {}
`,
      "src/second.ts": `/**
 * @evidence docs/rules.md#no-hardcoding The general logic decides here too.
 * @evidenceReview docs/rules.md#no-hardcoding ` + first + ` Read the rule against this module.
 * @evidence docs/rules.md#no-whack-a-mole Every sibling case is covered here too.
 * @evidenceReview docs/rules.md#no-whack-a-mole ` + second + ` Read the rule against this module.
 */
export function second(): void {}
`,
    }
  }
  expected := everyExpectedFingerprint(t, build(checklistDocument, "", ""), config)
  reviewed := build(
    checklistDocument,
    "#"+expected["docs/rules.md#no-hardcoding"],
    "#"+expected["docs/rules.md#no-whack-a-mole"],
  )
  assertNoProblems(t, runIndexRule(t, reviewed, config))

  edited := strings.Replace(
    checklistDocument,
    "Fix the general logic instead of special-casing a fixture.",
    "Fix the general logic instead of special-casing a fixture or an expected value.",
    1,
  )
  if edited == checklistDocument {
    t.Fatal("the edit did not reach the first item's body")
  }
  reviewed["docs/rules.md"] = edited
  stale := runIndexRule(t, reviewed, config)
  if count := countProblemsContaining(stale, "Stale @evidenceReview"); count != 2 {
    t.Fatalf("expected both hosts to expire on the edited item, got %d:\n%s", count, strings.Join(stale, "\n"))
  }
  if strings.Contains(strings.Join(stale, "\n"), "no-whack-a-mole") {
    t.Fatalf("an untouched item expired with its sibling:\n%s", strings.Join(stale, "\n"))
  }

  // Everything above still passes with `checklist` deleted, because a
  // fingerprint belongs to the cited address and two targets always expire
  // separately. What the option contributes is that the one-tag shortcut below
  // is no longer available, so the two arms are asserted against each other.
  document := map[string]string{
    "docs/rules.md": checklistDocument,
    "src/broad.ts": `/**
 * @evidence docs/rules.md Everything in here is honored.
 * @evidenceReview docs/rules.md #0000000000000000 Read the whole document.
 */
export function broad(): void {}
`,
  }
  ordinary := strings.Replace(config, `"checklist":true,`, "", 1)
  if ordinary == config {
    t.Fatal("the ordinary twin did not drop the checklist option")
  }
  if _, asked := everyExpectedFingerprint(t, document, ordinary)["docs/rules.md"]; !asked {
    t.Fatal("the ordinary reference must accept one document-wide review and name its value")
  }

  refused := runIndexRule(t, document, config)
  assertProblemContains(t, refused, "Aggregate @evidence target 'docs/rules.md'")
  // The refusal returns before the review check on purpose: the citation is
  // already failing, and an Unreviewed message beside it would name a second
  // repair for a tag that must not exist here at all.
  for _, marker := range []string{"Unreviewed @evidence", "Stale @evidenceReview"} {
    if strings.Contains(strings.Join(refused, "\n"), marker) {
      t.Fatalf("a refused aggregate also reported %q:\n%s", marker, strings.Join(refused, "\n"))
    }
  }
}
