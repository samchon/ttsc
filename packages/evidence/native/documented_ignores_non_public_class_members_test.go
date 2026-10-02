package evidence

import "testing"

/**
 * Verifies private and protected members are exempt.
 *
 * They are not part of the public contract, so they are not claim hosts, and
 * demanding blocks on them would make the rule about style rather than about
 * whether a citation can exist.
 *
 *  1. Leave private, protected, and private-name members undocumented beside a public method.
 *  2. Run the rule.
 *  3. Assert only the undocumented public Service.prototype.run method is reported.
 *
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over a documented class `Service` with undocumented `private cache()`, `protected reset()`, `#secret` and `public run()` members; assertReported requires exactly one diagnostic, `Missing JSDoc on exported function 'Service.prototype.run'`.
 * @evidence contracts/testing.md#independent-expectations The expected single report is authored from the documented-rule contract: private, protected and #private members are not part of the public contract, so only the undocumented public method may be reported.
 * @evidence contracts/testing.md#distinguishing-cases The undocumented public method is the control that shows class members are still selected; the exactly-one assertion fails if any of the three non-public members is reported or if the public member is not.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedIgnoresNonPublicClassMembers is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
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
