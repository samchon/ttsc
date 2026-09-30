package evidence

import "testing"

/**
 * Verifies public class member variables are selected.
 *
 * A public field is a property unit and a claim host, so it belongs to the
 * population that must be able to carry a tag. Its twin above covers the
 * callable half; without this one a field could quietly leave the population
 * while the suite stayed green.
 *
 *  1. Leave one public field undocumented on an exported class.
 *  2. Run the rule.
 *  3. Assert the field is reported under its qualified name.
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies public class member variables are selected. The original assertions check assert the field is reported under its qualified name.
 * @evidence contracts/testing.md#independent-expectations A public field is a property unit and a claim host, so it belongs to the population that must be able to carry a tag. Its twin above covers the callable half; without this one a field could quietly leave the population while the suite stayed green. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence contracts/testing.md#distinguishing-cases Leave one public field undocumented on an exported class. Run the rule. Assert the field is reported under its qualified name. The assertions and inputs in this function retain its own failure identity.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedSelectsPublicClassFields is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDocumentedSelectsPublicClassFields(t *testing.T) {
  messages := runDocumentedRule(t, "src/Service.ts", `
/** A service the application exposes. */
export class Service {
  public readonly retries: number = 3;
}
`, "")
  assertReported(t, messages, "Missing JSDoc on exported property 'Service.prototype.retries'")
}
