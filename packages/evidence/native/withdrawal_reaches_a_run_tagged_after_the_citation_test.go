package evidence

import (
  "testing"
)

/**
 * Verifies the withdrawal reaches a run whose tagged half comes second.
 *
 * The unit is marked by whichever declaration carries the tag, not by the one
 * written first, and that back-fill is the whole mechanism the host
 * reconciliation reads. Every other case here tags the first declaration, so
 * removing the back-fill left the suite green while an untagged-first run
 * silently went back to hosting a citation.
 *
 *  1. Cite the first declaration of an overload run and withdraw the second.
 *  2. Evaluate a `symbol: "function"` claim over that file.
 *  3. Assert the citation is refused and the section stays unacknowledged.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert the citation is refused and the section stays unacknowledged.
 * @evidence contracts/testing.md#independent-expectations The unit is marked by whichever declaration carries the tag, not by the one written first, and that back-fill is the whole mechanism the host reconciliation reads. Every other case here tags the first declaration, so removing the back-fill left the suite green while an untagged-first run silently went back to hosting a citation. The authored scenario requires this outcome: Assert the citation is refused and the section stays unacknowledged.
 * @evidence contracts/testing.md#distinguishing-cases Cite the first declaration of an overload run and withdraw the second. Evaluate a `symbol: "function"` claim over that file. Assert the citation is refused and the section stays unacknowledged.
 * @evidence contracts/testing.md#execution-ownership TestWithdrawalReachesARunTaggedAfterTheCitation runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestWithdrawalReachesARunTaggedAfterTheCitation(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Pricing {#pricing}\n",
    "src/Sale.ts": `
export class Sale {
  /** @evidence docs/spec.md#pricing The untagged half hosts nothing either. */
  compute(amount: number): void;
  /**
   * @internal
   */
  compute(amount: string): void;
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
  assertProblemContains(t, messages, "unsupported or non-exported declaration")
  assertProblemContains(t, messages, "Missing acknowledgement for 'docs/spec.md#pricing'")
}
