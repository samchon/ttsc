package evidence

import "testing"

/**
 * Verifies public class member variables are selected.
 *
 * A public field is a property unit and a claim host, so it belongs to the
 * population that must be able to carry a tag. TestDocumentedSelectsPublicClassMethods covers the
 * callable half; without this one a field could quietly leave the population
 * while the suite stayed green.
 *
 *  1. Leave one public field undocumented on an exported class.
 *  2. Run the rule.
 *  3. Assert the field is reported under its qualified name.
 *
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over a documented `export class Service` with an undocumented `public readonly retries` field; assertReported requires exactly one diagnostic, `Missing JSDoc on exported property 'Service.prototype.retries'`.
 * @evidence contracts/testing.md#independent-expectations The expected name is authored from the addressing contract: a public field is a property unit and claim host, so it must be demanded under its qualified instance address.
 * @evidence contracts/testing.md#distinguishing-cases One public field on a documented class; the public method half is owned by the sibling methods entry and non-public members by the non-public entry.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedSelectsPublicClassFields is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
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
