package evidence

import (
  "testing"
)

/**
 * Verifies `requireReview` judges an exclusion, and names the exclusion review tag
 * in its repair.
 *
 * This is the half that can silently regress: `reviewProblems` has no tag filter, so an `@evidenceExclude`
 * under a reviewing reference reaches it, and nothing exercised
 * `reviewMarkerFor(declaration.Tag)` with an exclusion or the ledger key with
 * `"evidenceExclude"` in it. A missed `Reviews` field at any construction site
 * fails closed — the key matches nothing and every review reports unreviewed — so
 * the failure would look like a rule working correctly on a project that is wrong.
 *
 *  1. Exclude one H2 under a `requireReview` reference and read the fingerprint the
 *     graph asks for.
 *  2. Answer it with `@evidenceExcludeReview` and assert the graph is clean.
 *  3. Answer it with `@evidenceReview` instead and assert it is still unreviewed,
 *     so the citation's tag cannot discharge an exclusion.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule reports an unreviewed exclusion and exclusion-specific repair, accepts its extracted token under evidenceExcludeReview, and rejects an ordinary evidenceReview answer.
 * @evidence contracts/testing.md#independent-expectations Exclusions owe their own review kind under requireReview; a citation review cannot discharge that opposite question. The extracted token is setup, not an exact digest oracle.
 * @evidence contracts/testing.md#distinguishing-cases Unreviewed, correctly reviewed and wrong-kind reviewed source variants keep the same target and host.
 * @evidence contracts/testing.md#execution-ownership TestRequireReviewJudgesAnExclusion is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestRequireReviewJudgesAnExclusion(t *testing.T) {
  document := "## Pricing\n\nThe rate is capped at 30%.\n"
  bare := `/**
 * @evidenceExclude docs/spec.md#pricing The pricing engine owns this, not the view model.
 */
export interface ISale {
  price: number;
}
`
  unreviewed := runIndexRule(t, map[string]string{
    "docs/spec.md": document,
    "src/ISale.ts": bare,
  }, requireReviewConfig)
  assertProblemContains(t, unreviewed, "Unreviewed @evidenceExclude for 'docs/spec.md#pricing'")
  assertProblemContains(t, unreviewed, "Add '@evidenceExcludeReview docs/spec.md#pricing #")
  fingerprint := ""
  for _, message := range unreviewed {
    if asksForAFingerprint(message) {
      fingerprint = shapedFingerprint(message)
      break
    }
  }
  if fingerprint == "" {
    t.Fatalf("expected the exclusion finding to name a fingerprint, got:\n%v", unreviewed)
  }

  assertNoProblems(t, runIndexRule(t, map[string]string{
    "docs/spec.md": document,
    "src/ISale.ts": `/**
 * @evidenceExclude docs/spec.md#pricing The pricing engine owns this, not the view model.
 * @evidenceExcludeReview docs/spec.md#pricing #` + fingerprint + ` Read the section: every rule in it names a price authority, none names this view.
 */
export interface ISale {
  price: number;
}
`,
  }, requireReviewConfig))

  assertProblemContains(t, runIndexRule(t, map[string]string{
    "docs/spec.md": document,
    "src/ISale.ts": `/**
 * @evidenceExclude docs/spec.md#pricing The pricing engine owns this, not the view model.
 * @evidenceReview docs/spec.md#pricing Filed under the wrong question.
 */
export interface ISale {
  price: number;
}
`,
  }, requireReviewConfig), "Unreviewed @evidenceExclude for 'docs/spec.md#pricing'")
}
