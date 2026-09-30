package linthost

import "testing"

// TestRuleCorpusPromiseNoReturnWrap verifies promise/no-return-wrap reports
// redundant Promise.resolve wrapping inside a promise callback.
//
// The callback already returns into a promise chain, so wrapping the value adds
// noise without changing the result.
//
// 1. Enable promise/no-return-wrap.
// 2. Return Promise.resolve from a then handler.
// 3. Assert the wrapped return is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original Promise.resolve wrapping inside a then callback and permits returning the unwrapped value.
// @evidence contracts/testing.md#independent-expectations A then callback already adopts its return value; the authored expectation selects unnecessary wrapping independently of the rule calculation.
// @evidence contracts/testing.md#distinguishing-cases The wrapped block return reports; plain block and expression-bodied value returns stay clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPromiseNoReturnWrap owns its annotated positive fixture and explicit clean control through assertRuleCorpusCase and assertRuleSkipsSource. The shared Go unit runner invokes Engine on parsed virtual source in one process; no installed consumer, native artifact build or product host is used.
func TestRuleCorpusPromiseNoReturnWrap(t *testing.T) {
  assertRuleCorpusCase(t, "promise/no-return-wrap.ts", "Promise.resolve(1).then(() => {\n  // expect: promise/no-return-wrap error\n  return Promise.resolve(2);\n});\n")
  assertRuleSkipsSource(t, "promise/no-return-wrap", "Promise.resolve(1).then(() => { return 2; }); Promise.resolve(1).then(() => 2);\n")
}
