package evidence

import "testing"

/**
 * Verifies private and protected members are exempt.
 *
 * They are not part of the public contract, so they are not claim hosts, and
 * demanding blocks on them would make the rule about style rather than about
 * whether a citation can exist.
 *
 *  1. Leave private and protected members undocumented.
 *  2. Run the rule.
 *  3. Assert silence.
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies private and protected members are exempt. The original assertions check assert silence.
 * @evidence contracts/testing.md#independent-expectations They are not part of the public contract, so they are not claim hosts, and demanding blocks on them would make the rule about style rather than about whether a citation can exist. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Leave private and protected members undocumented. Run the rule. Assert silence. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedIgnoresNonPublicClassMembers is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDocumentedIgnoresNonPublicClassMembers(t *testing.T) {
  // The undocumented public member is the control. Asserting silence over
  // non-public members alone would pass just as well if class members had
  // stopped being selected at all, which is the opposite of what this rule
  // guarantees, so the case demands that exactly the public one is reported.
  assertReported(t, runDocumentedRule(t, "src/Service.ts", `
/** A service the application exposes. */
export class Service {
  private cache(): void {}
  protected reset(): void {}
  #secret: number = 1;
  public run(): void {}
}
`, ""), "Missing JSDoc on exported function 'Service.prototype.run'")
}
