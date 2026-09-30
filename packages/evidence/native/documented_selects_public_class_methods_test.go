package evidence

import "testing"

/**
 * Verifies public class methods are selected.
 *
 * A public method is a function unit and a claim host, so it belongs to the
 * population that must be able to carry a tag.
 *
 *  1. Leave one public method undocumented on an exported class.
 *  2. Run the rule.
 *  3. Assert the method is reported under its qualified name.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies public class methods are selected. The original assertions check assert the method is reported under its qualified name.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A public method is a function unit and a claim host, so it belongs to the population that must be able to carry a tag. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Leave one public method undocumented on an exported class. Run the rule. Assert the method is reported under its qualified name. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDocumentedSelectsPublicClassMethods is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDocumentedSelectsPublicClassMethods(t *testing.T) {
  messages := runDocumentedRule(t, "src/Service.ts", `
/** A service the application exposes. */
export class Service {
  public run(): void {}
}
`, "")
  assertReported(t, messages, "Missing JSDoc on exported function 'Service.prototype.run'")
}
