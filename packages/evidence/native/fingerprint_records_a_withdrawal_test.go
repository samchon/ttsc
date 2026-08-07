package evidence

import (
  "testing"
)

const withdrawalConfig = `{"claims":[{
  "type":"typescript",
  "files":["src/claim/**"],
  "symbol":"type",
  "reference":{
    "type":"typescript",
    "files":["src/spec/**"],
    "symbol":["type","property"],
    "requireReview":true
  }
}]}`

/**
 * Verifies withdrawing a member of a cited scope expires its review, while churn
 * behind the tag does not.
 *
 * Overall Self-Review round 4 caught the comment before the behavior: the
 * rationale claimed a withdrawn descendant was folded in like any other, and it
 * was not folded in at all, because `availableUnits` skips a hidden unit before
 * the population is built. Both extremes are wrong. Folding its content in lets
 * private churn behind `@internal` expire a review of the public contract, which
 * the author cannot act on. Leaving it out entirely hides the withdrawal, and
 * removing a member from the public surface is exactly what a review of that
 * surface should be asked about again.
 *
 * So a withdrawn unit contributes its identity and the tag that withdrew it,
 * never its content.
 *
 *  1. Cite a type whose property is public, and review it with the expected value.
 *  2. Withdraw that property with `@internal` and assert the review is stale.
 *  3. Change the withdrawn property's type and assert the review stays valid,
 *     because nothing public moved.
 */
func TestFingerprintRecordsAWithdrawal(t *testing.T) {
  citing := func(fingerprint string) string {
    return `import type { ISale } from "../spec/ISale";

/**
 * @evidence {@link ISale} Mirrors the sale contract.
 * @evidenceReview {@link ISale} #` + fingerprint + ` Every public property of ISale appears here.
 */
export interface IView {
  price: number;
}
`
  }
  bare := `import type { ISale } from "../spec/ISale";

/**
 * @evidence {@link ISale} Mirrors the sale contract.
 */
export interface IView {
  price: number;
}
`
  public := `export interface ISale {
  price: number;
  audit: string;
}
`
  fingerprint := reviewedFingerprintAt(t, map[string]string{
    "src/spec/ISale.ts":  public,
    "src/claim/IView.ts": bare,
  }, withdrawalConfig)
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "src/spec/ISale.ts":  public,
    "src/claim/IView.ts": citing(fingerprint),
  }, withdrawalConfig))

  withdrawn := `export interface ISale {
  price: number;
  /** @internal */
  audit: string;
}
`
  assertProblemContains(t, runIndexRule(t, map[string]string{
    "src/spec/ISale.ts":  withdrawn,
    "src/claim/IView.ts": citing(fingerprint),
  }, withdrawalConfig), "Stale @evidenceReview")

  churned := `export interface ISale {
  price: number;
  /** @internal */
  audit: number;
}
`
  stale := reviewedFingerprintAt(t, map[string]string{
    "src/spec/ISale.ts":  withdrawn,
    "src/claim/IView.ts": bare,
  }, withdrawalConfig)
  churnedExpected := reviewedFingerprintAt(t, map[string]string{
    "src/spec/ISale.ts":  churned,
    "src/claim/IView.ts": bare,
  }, withdrawalConfig)
  if stale != churnedExpected {
    t.Fatal("changing a withdrawn member's type moved the fingerprint, so private churn expires a public review")
  }
}
