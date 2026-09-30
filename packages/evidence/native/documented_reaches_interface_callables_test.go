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
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies the rule reaches an interface's callables and counts an overload run once. The original assertions check assert exactly two findings, one per undocumented identity.
 * @evidence contracts/testing.md#independent-expectations These members were invisible to the unit model, so this rule asked nothing of them however public the interface was. They are `function` units now, which means every interface method in every project becomes a declaration this rule demands a block on, with no claim configured anywhere. That is the change's widest consequence and it belongs in a case rather than in a release note. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Document the interface and two of its members, leaving a plain method and an overload run bare. Run the rule. Assert exactly two findings, one per undocumented identity. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedReachesInterfaceCallables is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
