package evidence

import (
  "testing"
)

/**
 * Verifies a live class member is an exclusion carrier for a claim that does
 * not select its kind.
 *
 * The positive twin of the complementary case, and what makes that one mean anything:
 * a refusal reads as "withdrawal took the carrier" only if the same declaration
 * is accepted when nothing withdrew it. The carrier here is therefore the same
 * declaration the refusal names, an overload run's implementation half, with
 * the `@internal` block on its sibling signature removed. The other differences
 * are what the assertions need, plus the second carrier the paragraph below
 * explains.
 *
 * The field beside it is deliberately the wrong kind for the claim. Carrier
 * eligibility is wider than host eligibility by design, so a `property` member
 * carries an exclusion for a `function` claim, and the two carriers together
 * say the width is about the tag rather than about the member kind.
 *
 * A second section nobody excludes is what keeps the case from passing on
 * silence. An empty selected population is silent too, and so is a claim whose
 * glob matches nothing, so asserting the remaining section is reported is the
 * only assertion that distinguishes an accepted exclusion from a claim that
 * never ran.
 *
 *  1. Exclude one section from an overload run's implementation half and
 *     another from a field, under a `symbol: "function"` claim, leaving a third
 *     section alone.
 *  2. Evaluate the claim.
 *  3. Assert only the untouched section is reported.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule drives graphRule.Check over a class whose readonly property and overload implementation each carry an @evidenceExclude under a symbol "function" claim, and assertReported requires exactly one diagnostic, the missing acknowledgement for the untouched Uncited section.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the exclusion contract: of three Markdown sections, two are excluded by tags on live class members, so exactly the third must remain owed, with the literal message "Missing acknowledgement for 'docs/spec.md#uncited'"; it is not read back from the implementation.
 * @evidence contracts/testing.md#distinguishing-cases A positive-acceptance case only: both exclusions are honored, one on a member kind the claim does not select (the property) and one on the implementation half of an overload run, and the still-owed third section separates honored exclusions from a claim that never ran. The refused or withdrawn-carrier counterpart is not run in this body.
 * @evidence contracts/testing.md#execution-ownership TestLiveClassMemberIsAnExclusionCarrier runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestLiveClassMemberIsAnExclusionCarrier(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Pricing {#pricing}\n\n## Charging {#charging}\n\n## Uncited {#uncited}\n",
    "src/Sale.ts": `
export class Sale {
  /** @evidenceExclude docs/spec.md#pricing This subject fixes no price. */
  readonly price: number = 0;
  compute(amount: number): void;
  /** @evidenceExclude docs/spec.md#charging This subject charges nowhere. */
  compute(amount: unknown): void {}
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/Sale.ts"],
    "symbol":"function",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertReported(t, messages, "Missing acknowledgement for 'docs/spec.md#uncited'")
}
