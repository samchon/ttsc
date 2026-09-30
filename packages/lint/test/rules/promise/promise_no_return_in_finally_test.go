package linthost

import "testing"

// TestRuleCorpusPromiseNoReturnInFinally verifies promise/no-return-in-finally
// reports returns inside promise finally callbacks.
//
// Promise finally preserves the prior fulfillment value rather than using the
// cleanup callback return as a replacement, making that return misleading.
//
// 1. Enable promise/no-return-in-finally.
// 2. Return a value from a finally callback.
// 3. Assert the return statement is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the return statement in the original promise finally handler and permits side-effect-only cleanup.
// @evidence contracts/testing.md#independent-expectations The annotation follows the rule policy that finally handlers should not return a value; Promise finally does not replace fulfillment with that returned value.
// @evidence contracts/testing.md#distinguishing-cases Returning from finally reports; a finally handler with only console cleanup stays clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPromiseNoReturnInFinally owns its annotated positive fixture and explicit clean control through assertRuleCorpusCase and assertRuleSkipsSource. The shared Go unit runner invokes Engine on parsed virtual source in one process; no installed consumer, native artifact build or product host is used.
func TestRuleCorpusPromiseNoReturnInFinally(t *testing.T) {
  assertRuleCorpusCase(t, "promise/no-return-in-finally.ts", "Promise.resolve(1).finally(() => {\n  // expect: promise/no-return-in-finally error\n  return 2;\n});\n")
  assertRuleSkipsSource(t, "promise/no-return-in-finally", "Promise.resolve(1).finally(() => { console.log(\"cleanup\"); });\n")
}
