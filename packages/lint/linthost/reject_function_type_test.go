package linthost

import "testing"

// TestRuleJSDocRejectFunctionType verifies jsdoc/reject-function-type reports
// the `Function` identifier in a JSDoc type, including inside a generic, and
// accepts explicit callable types and other spellings.
//
// 1. Run the rule over `@param {Function}` and expect a finding on line 3.
// 2. Run a subtest with the Closure signature `function(): void` and expect none.
// 3. Run three subtests that place `FUNCTION`, `Array<Function>` and
//    `() => void` in the type brace and expect a finding only for the middle one.
//
// @evidence contracts/testing.md#behavioral-verification assertJSDocRuleLines runs the registered jsdoc/reject-function-type rule through NewEngine.Run over a parsed virtual TypeScript file. `{Function}` and `{Array<Function>}` each yield one finding on line 3 with that rule at error severity; `{function(): void}`, `{FUNCTION}` and `{() => void}` yield none.
// @evidence contracts/testing.md#independent-expectations The unrestricted Function type has no call signature, while an explicit callable type is the accepted alternative. The literal sources and expected line 3 follow from that policy; the message text is not asserted.
// @evidence contracts/testing.md#distinguishing-cases `Function` versus the Closure signature and the arrow signature isolates the bare identifier; `FUNCTION` isolates exact spelling; `Array<Function>` isolates a nested occurrence.
// @evidence contracts/testing.md#execution-ownership The Test body makes one direct helper call, one named subtest and a loop of three more t.Run subtests from one literal table, each calling assertJSDocRuleLines once with its own source; the subtests run in the same test process as the parent with no installed consumer, native build or host.
func TestRuleJSDocRejectFunctionType(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/reject-function-type", `/**
 * Registers a callback.
 * @param {Function} handler description
 */
export function register(handler: () => void): void {
  handler();
}
`, 3)
  t.Run("explicit Closure signature", func(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/reject-function-type", "/**\n * Explains the declaration.\n * @param {function(): void} handler description\n */\nexport function value(name: unknown): unknown { return name; }\n")
  })
  for _, caseInput := range []struct { name string; docType string; report bool }{
    { "named FUNCTION", "FUNCTION", false },
    { "nested Function", "Array<Function>", true },
    { "explicit arrow signature", "() => void", false },
  } {
    t.Run(caseInput.name, func(t *testing.T) {
      source := "/**\n * Handles the input.\n * @param {" + caseInput.docType + "} value Input value.\n */\nexport function handle(value: unknown): unknown { return value; }\n"
      if caseInput.report {
        assertJSDocRuleLines(t, "jsdoc/reject-function-type", source, 3)
      } else {
        assertJSDocRuleLines(t, "jsdoc/reject-function-type", source)
      }
    })
  }
}
