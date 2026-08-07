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
 * Verifies withdrawing a member of a cited scope expires its review, and that
 * churn behind the tag expires it too.
 *
 * The second half is the honest part, and CI is what forced it. Round 4 claimed a
 * withdrawn descendant contributes its identity and not its content, so private
 * churn behind `@internal` would be invisible. That is impossible as stated: a
 * TypeScript unit's digest is its whole declaration text, so the withdrawn
 * member's body is already inside the enclosing type's digest and no substitution
 * in the composite can take it out. The claim was written on a model of "own
 * content excludes descendants" that is true for Markdown and false for
 * TypeScript.
 *
 * What survives is the half that works and is worth having. A withdrawal moves the
 * fingerprint, which it otherwise would not: `@internal` lives in a documentation
 * block, every such block is excluded as a tag position, so adding one leaves the
 * declaration's text untouched and the withdrawal would pass unnoticed. The
 * remaining noise — churn behind the tag also expiring the review — is
 * conservative rather than wrong, and it is pinned here rather than left for
 * someone to rediscover as a defect.
 *
 *  1. Cite a type whose property is public, and review it with the expected value.
 *  2. Withdraw that property with `@internal` and assert the review is stale.
 *  3. Change the withdrawn property's type and assert the fingerprint moves again,
 *     which is the documented cost of a digest that is a declaration's own text.
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
