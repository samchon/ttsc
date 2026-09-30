package linthost

import "testing"

// TestRuleCorpusPromiseNoCallbackInPromise verifies promise/no-callback-in-promise
// reports callback calls inside promise handlers.
//
// The callback names mirror eslint-plugin-promise's common callback blacklist.
//
// 1. Declare a callback-shaped function name.
// 2. Call it inside a then handler.
// 3. Assert the callback call is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports cb invoked inside a then handler without reporting that callback outside a promise handler.
// @evidence contracts/testing.md#independent-expectations The authored callback-name policy identifies cb as the forbidden bridge inside the original promise callback; the fixed annotation is authored independently of rule output.
// @evidence contracts/testing.md#distinguishing-cases The original in-handler call reports; an outside cb call and a non-callback helper inside then are clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPromiseNoCallbackInPromise owns its annotated positive fixture and explicit clean control through assertRuleCorpusCase and assertRuleSkipsSource. The shared Go unit runner invokes Engine on parsed virtual source in one process; no installed consumer, native artifact build or product host is used.
func TestRuleCorpusPromiseNoCallbackInPromise(t *testing.T) {
  assertRuleCorpusCase(t, "promise/no-callback-in-promise.ts", "declare const cb: () => void;\nPromise.resolve(1).then(() => {\n  // expect: promise/no-callback-in-promise error\n  cb();\n});\n")
  assertRuleSkipsSource(t, "promise/no-callback-in-promise", "cb(); Promise.resolve(1).then(() => { work(); });\n")
}
