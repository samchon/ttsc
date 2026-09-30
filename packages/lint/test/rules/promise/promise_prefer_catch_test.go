package linthost

import "testing"

// TestRuleCorpusPromisePreferCatch verifies promise/prefer-catch reports the
// second rejection-handler argument to then().
//
// The handler is clearer and easier to compose when spelled as a following
// catch() call.
//
// 1. Enable promise/prefer-catch.
// 2. Pass a rejection handler as the second then argument.
// 3. Assert that rejection handler is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original second then argument while allowing a separate catch and a one-argument then call.
// @evidence contracts/testing.md#independent-expectations The authored diagnostic follows the preference for catch over a rejection callback passed to then; expected location is the second argument.
// @evidence contracts/testing.md#distinguishing-cases The second-handler original reports; separate catch and fulfillment-only then remain clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPromisePreferCatch owns its annotated positive fixture and explicit clean control through assertRuleCorpusCase and assertRuleSkipsSource. The shared Go unit runner invokes Engine on parsed virtual source in one process; no installed consumer, native artifact build or product host is used.
func TestRuleCorpusPromisePreferCatch(t *testing.T) {
  assertRuleCorpusCase(t, "promise/prefer-catch.ts", "Promise.resolve(1).then(\n  (value) => value,\n  // expect: promise/prefer-catch error\n  (error) => console.error(error),\n);\n")
  assertRuleSkipsSource(t, "promise/prefer-catch", "Promise.resolve(1).then(value => value).catch(error => console.error(error));\n")
}
