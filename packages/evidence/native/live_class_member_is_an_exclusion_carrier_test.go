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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert only the untouched section is reported.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The positive twin of the complementary case, and what makes that one mean anything: a refusal reads as "withdrawal took the carrier" only if the same declaration is accepted when nothing withdrew it. The carrier here is therefore the same declaration the refusal names, an overload run's implementation half, with the `@internal` block on its sibling signature removed. The other differences are what the assertions need, plus the second carrier the paragraph below explains. The authored scenario requires this outcome: Assert only the untouched section is reported.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Exclude one section from an overload run's implementation half and another from a field, under a `symbol: "function"` claim, leaving a third section alone. Evaluate the claim. Assert only the untouched section is reported.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestLiveClassMemberIsAnExclusionCarrier runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
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
