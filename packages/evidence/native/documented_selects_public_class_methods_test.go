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
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over a documented `export class Service` with an undocumented `public run()` method; assertReported requires exactly one diagnostic, `Missing JSDoc on exported function 'Service.prototype.run'`.
 * @evidence contracts/testing.md#independent-expectations The expected name is authored from the addressing contract: a public method is a function unit and claim host, so it must be demanded under its qualified instance address.
 * @evidence contracts/testing.md#distinguishing-cases One public method on a documented class; the field half is owned by the sibling fields entry.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedSelectsPublicClassMethods is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
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
