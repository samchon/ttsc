package evidence

import (
  "testing"
)

/**
 * Verifies a withdrawn member's other declarations host nothing either.
 *
 * An overload run is one member spelled several times, and the tag sits on
 * whichever declaration the author documented. Resolving withdrawal per node
 * marked the unit and still registered the untagged sibling as a claim host, so
 * a method taken out of the API kept discharging coverage, silently, because
 * the unit really was marked. The unit assertion alone cannot see that: it is
 * the host side that leaks.
 *
 *  1. Withdraw the first declaration of an overload run and cite the second.
 *  2. Evaluate a `symbol: "function"` claim over that file.
 *  3. Assert the citation is refused and the section stays unacknowledged.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert the citation is refused and the section stays unacknowledged.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations An overload run is one member spelled several times, and the tag sits on whichever declaration the author documented. Resolving withdrawal per node marked the unit and still registered the untagged sibling as a claim host, so a method taken out of the API kept discharging coverage, silently, because the unit really was marked. The unit assertion alone cannot see that: it is the host side that leaks. The authored scenario requires this outcome: Assert the citation is refused and the section stays unacknowledged.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Withdraw the first declaration of an overload run and cite the second. Evaluate a `symbol: "function"` claim over that file. Assert the citation is refused and the section stays unacknowledged.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestWithdrawnMethodHostsNothingOnItsOtherDeclarations runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestWithdrawnMethodHostsNothingOnItsOtherDeclarations(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "docs/spec.md": "## Pricing {#pricing}\n",
    "src/Sale.ts": `
export class Sale {
  /**
   * @internal
   */
  compute(amount: number): void;
  /** @evidence docs/spec.md#pricing A withdrawn method hosts nothing. */
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
