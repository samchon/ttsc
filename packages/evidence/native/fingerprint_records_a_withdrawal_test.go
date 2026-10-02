package evidence

import (
  "testing"
)

/**
 * Verifies withdrawing a member of a cited scope expires its review, and that
 * churn behind the tag expires it too.
 *
 * A withdrawn descendant contributes its identity to the composite, but its
 * content cannot be taken out: a TypeScript unit's digest is its whole
 * declaration text, so the withdrawn member's body is already inside the
 * enclosing type's digest. That differs from Markdown, where a unit's own content
 * excludes its descendants.
 *
 * A withdrawal moves the fingerprint, which it otherwise would not: `@internal`
 * lives in a documentation block, every such block is excluded as a tag position,
 * so adding one leaves the declaration's text untouched and the withdrawal would
 * pass unnoticed. Churn behind the tag also expires the review. That is
 * conservative rather than wrong, and it is pinned here as the cost of a digest
 * that is a declaration's own text.
 *
 *  1. Cite a type whose property is public, and review it with the expected value.
 *  2. Withdraw that property with `@internal` and assert the review is stale.
 *  3. Change the withdrawn property's type and assert the fingerprint moves again,
 *     which is the documented cost of a digest that is a declaration's own text.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule accepts a reviewed ISale baseline, then @internal on audit must stale the review and move the token; changing withdrawn audit's type must move it again.
 * @evidence contracts/testing.md#independent-expectations A subtree withdrawal affects its review scope; TypeScript's whole declaration text also conservatively includes hidden-member executable churn. Diagnostic-derived tokens cannot certify the hash algorithm.
 * @evidence contracts/testing.md#distinguishing-cases Documentation-only withdrawal and later hidden-member number/string churn are distinct transitions; the latter intentionally does not prove hidden text is excluded.
 * @evidence contracts/testing.md#execution-ownership TestFingerprintRecordsAWithdrawal is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
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
  afterWithdrawal := reviewedFingerprintAt(t, map[string]string{
    "src/spec/ISale.ts":  withdrawn,
    "src/claim/IView.ts": bare,
  }, withdrawalConfig)
  if afterWithdrawal == fingerprint {
    t.Fatal("withdrawing a member left the fingerprint unmoved, so a shrinking public surface never expires a review")
  }
  afterChurn := reviewedFingerprintAt(t, map[string]string{
    "src/spec/ISale.ts":  churned,
    "src/claim/IView.ts": bare,
  }, withdrawalConfig)
  if afterChurn == afterWithdrawal {
    t.Fatal("a withdrawn member's type is inside its ancestor's declaration text, so changing it must move that ancestor's digest; if this passes, the digest stopped covering the declaration as written")
  }
}
