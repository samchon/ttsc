package evidence

import (
  "testing"
)

/**
 * Verifies a withdrawn member is not an exclusion carrier either.
 *
 * Carrier eligibility is wider than host eligibility, and it reads the same
 * host set, so a leak there is a second way for a withdrawn declaration to
 * settle an obligation. Excluding through one is worse than citing through one:
 * the reason field makes it read as a reviewed decision.
 *
 *  1. Exclude a section from the untagged half of a withdrawn member.
 *  2. Evaluate a `symbol: "function"` claim over that file.
 *  3. Assert the carrier is refused and the section stays unacknowledged.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert the carrier is refused and the section stays unacknowledged.
 * @evidence contracts/testing.md#independent-expectations Carrier eligibility is wider than host eligibility, and it reads the same host set, so a leak there is a second way for a withdrawn declaration to settle an obligation. Excluding through one is worse than citing through one: the reason field makes it read as a reviewed decision. The authored scenario requires this outcome: Assert the carrier is refused and the section stays unacknowledged.
 * @evidence contracts/testing.md#distinguishing-cases Exclude a section from the untagged half of a withdrawn member. Evaluate a `symbol: "function"` claim over that file. Assert the carrier is refused and the section stays unacknowledged.
 * @evidence contracts/testing.md#execution-ownership TestWithdrawnMemberIsNotAnExclusionCarrier runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestWithdrawnMemberIsNotAnExclusionCarrier(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Pricing {#pricing}\n",
    "src/Sale.ts": `
export class Sale {
  /**
   * @internal
   */
  compute(amount: number): void;
  /** @evidenceExclude docs/spec.md#pricing A withdrawn method carries nothing. */
  compute(amount: unknown): void {}
  charge(): void {}
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/Sale.ts"],
    "symbol":"function",
    "reference":{"type":"markdown","files":["docs/spec.md"],"symbol":"h2"}
  }]}`)
  assertProblemContains(
    t,
    messages,
    "'unsupported or non-exported declaration' is not an eligible exclusion carrier",
  )
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/spec.md#pricing'")
}
