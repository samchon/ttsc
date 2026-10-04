package linthost

import "testing"

// TestRuleJSDocRejectAnyType verifies jsdoc/reject-any-type reports the `any`
// identifier and the `*` wildcard in a JSDoc type and accepts `unknown`, `Any`
// and `ANY`.
//
// The rule inspects the JSDoc type payload and so applies even when
// jsdoc/no-types is not enabled.
//
// 1. Run the rule over `@param {any}` and expect a finding on line 3, then
//    over `@param {unknown}` and expect none.
// 2. Run four subtests that place `Any`, `ANY`, `Array<any>` and `*` in the
//    type brace and expect findings only for the last two.
//
// @evidence contracts/testing.md#behavioral-verification assertJSDocRuleLines runs the registered jsdoc/reject-any-type rule through NewEngine.Run over a parsed virtual TypeScript file. `{any}`, the nested `Array<any>` and the wildcard `*` each yield one finding on line 3 with that rule at error severity; `{unknown}`, `{Any}` and `{ANY}` yield none.
// @evidence contracts/testing.md#independent-expectations The rule forbids the unconstrained type any (spelled exactly any, or the * wildcard) while unknown is the accepted alternative. The literal sources and expected line 3 follow from that policy; the message text is not asserted.
// @evidence contracts/testing.md#distinguishing-cases The separately authored any/unknown blocks contrast their expected report/clean outcomes; `Any` and `ANY` isolate exact lowercase spelling from user type names; `Array<any>` isolates a nested occurrence; `*` isolates the wildcard spelling.
// @evidence contracts/testing.md#execution-ownership The Test body makes two direct helper calls and then registers four in-process t.Run subtests from one literal table, each calling assertJSDocRuleLines once with its own source; the subtests share the parent Test's entry and run in the test process with no installed consumer, native build or host.
func TestRuleJSDocRejectAnyType(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/reject-any-type", `/**
 * Handles an input.
 * @param {any} value description
 */
export function handle(value: unknown): unknown {
  return value;
}
`, 3)
  assertJSDocRuleLines(t, "jsdoc/reject-any-type", "/**\n * Explains the declaration.\n * @param {unknown} value description\n */\nexport function value(name: unknown): unknown { return name; }\n")
  for _, caseInput := range []struct { name string; docType string; report bool }{
    { "named Any", "Any", false },
    { "named ANY", "ANY", false },
    { "nested any", "Array<any>", true },
    { "wildcard", "*", true },
  } {
    t.Run(caseInput.name, func(t *testing.T) {
      source := "/**\n * Handles the input.\n * @param {" + caseInput.docType + "} value Input value.\n */\nexport function handle(value: unknown): unknown { return value; }\n"
      if caseInput.report {
        assertJSDocRuleLines(t, "jsdoc/reject-any-type", source, 3)
      } else {
        assertJSDocRuleLines(t, "jsdoc/reject-any-type", source)
      }
    })
  }
}
