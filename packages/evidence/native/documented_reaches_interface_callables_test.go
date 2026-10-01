package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies the rule reaches an interface's callables and counts an overload
 * run once.
 *
 * These members were invisible to the unit model, so this rule asked nothing of
 * them however public the interface was. They are `function` units now, which
 * means every interface method in every project becomes a declaration this rule
 * demands a block on, with no claim configured anywhere. That is the change's
 * widest consequence and it belongs in a case rather than in a release note.
 *
 * The documented members are what keeps it from passing for the wrong reason: a
 * rule that had simply started reporting the whole interface would name them
 * too, and the exact count would not hold.
 *
 *  1. Document the interface and two of its members, leaving a plain method and
 *     an overload run bare.
 *  2. Run the rule.
 *  3. Assert exactly two findings, one per undocumented identity.
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over a documented `interface ISale` whose documented `price` and documented arrow-typed `charge` sit beside an undocumented method `settle()` and an undocumented two-signature `refund` overload run; the test requires exactly two diagnostics, `Missing JSDoc on exported function 'ISale.settle'` and `Missing JSDoc on exported function 'ISale.refund'`.
 * @evidence contracts/testing.md#independent-expectations The expected findings are authored from the unit-model contract: interface callables are function units that the rule must demand a block on without any claim configured, and an overload run is one identity so it is reported once.
 * @evidence contracts/testing.md#distinguishing-cases The documented members keep the count exact: a rule that reported the whole interface or each refund signature separately would exceed two, and one that ignored interface methods would report none.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedReachesInterfaceCallables is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
 */
func TestDocumentedReachesInterfaceCallables(t *testing.T) {
  messages := runDocumentedRule(t, "src/ISale.ts", `
/** A sale offered to a customer. */
export interface ISale {
  /** The amount the customer pays. */
  price: number;
  /** Takes the amount. */
  charge: () => void;
  settle(): void;
  refund(amount: string): void;
  refund(amount: number): void;
}
`, "")
  if len(messages) != 2 {
    t.Fatalf("expected two findings, got %d:\n%s", len(messages), strings.Join(messages, "\n"))
  }
  assertReportedAmong(t, messages, "Missing JSDoc on exported function 'ISale.settle'")
  assertReportedAmong(t, messages, "Missing JSDoc on exported function 'ISale.refund'")
}
