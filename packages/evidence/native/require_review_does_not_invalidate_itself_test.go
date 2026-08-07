package evidence

import (
  "testing"
)

/**
 * Verifies writing a review inside a cited unit does not change that unit's
 * fingerprint.
 *
 * This is the failure that decides the digest's definition, and it is a
 * non-terminating repair loop rather than a wrong message. A TypeScript claim may
 * cite a TypeScript reference, so one file holds both a citation and a unit. If a
 * unit's digest covered its documentation block, the author would paste the
 * expected fingerprint, that very write would change the digest, and the next
 * build would name a new value forever.
 *
 * It is not limited to a unit citing itself, which is why the review here sits on
 * a **property** of the cited interface: a property's block is interior text of
 * the type containing it, so a per-declaration exclusion that only skipped the
 * outermost comment would still let this case invalidate every citation of
 * `ISale`.
 *
 *  1. A claim cites `ISale`, a TypeScript reference selects it, and the review is
 *     written with the fingerprint the graph asks for.
 *  2. Add a second documentation block on a property of `ISale`, changing nothing
 *     executable.
 *  3. Assert the graph stays clean, so the fingerprint did not move.
 */
func TestRequireReviewDoesNotInvalidateItself(t *testing.T) {
  config := `{"claims":[{
    "type":"typescript",
    "files":["src/claim/**"],
    "symbol":"type",
    "reference":{
      "type":"typescript",
      "files":["src/spec/**"],
      "symbol":"type",
      "requireReview":true
    }
  }]}`
  spec := `export interface ISale {
  price: number;
}
`
  citing := func(fingerprint string) string {
    return `import type { ISale } from "../spec/ISale";

/**
 * @evidence {@link ISale} Mirrors the sale contract.
 * @evidenceReview {@link ISale} #` + fingerprint + ` Every property of ISale appears here with the same type.
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
  fingerprint := reviewedFingerprintAt(t, map[string]string{
    "src/spec/ISale.ts":  spec,
    "src/claim/IView.ts": bare,
  }, config)
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "src/spec/ISale.ts":  spec,
    "src/claim/IView.ts": citing(fingerprint),
  }, config))

  documented := `export interface ISale {
  /**
   * The buyer-facing price.
   *
   * @evidenceReview docs/spec.md#pricing A block interior to the cited type.
   */
  price: number;
}
`
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "src/spec/ISale.ts":  documented,
    "src/claim/IView.ts": citing(fingerprint),
  }, config))
}
