package linthost

import "testing"

// TestRuleCorpusPromiseNoPromiseInCallback verifies promise/no-promise-in-callback
// reports promise chains inside error-first callbacks.
//
// The scenario is not returned from the callback, preserving the floating
// promise shape the upstream rule targets.
//
// 1. Enable promise/no-promise-in-callback.
// 2. Create an error-first callback function.
// 3. Assert a promise call inside that callback is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the unreturned Promise call inside the original error-first callback and permits a direct returned Promise.
// @evidence contracts/testing.md#independent-expectations The authored expectation follows the callback bridge policy; passing a promise back as the callback result differs from starting a floating promise.
// @evidence contracts/testing.md#distinguishing-cases The original err-first callback reports; the same shape directly returning its Promise is clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPromiseNoPromiseInCallback owns its annotated positive fixture and explicit clean control through assertRuleCorpusCase and assertRuleSkipsSource. The shared Go unit runner invokes Engine on parsed virtual source in one process; no installed consumer, native artifact build or product host is used.
func TestRuleCorpusPromiseNoPromiseInCallback(t *testing.T) {
  assertRuleCorpusCase(t, "promise/no-promise-in-callback.ts", "function done(err: Error | null) {\n  if (err) throw err;\n  // expect: promise/no-promise-in-callback error\n  Promise.resolve(1);\n}\n")
  assertRuleSkipsSource(t, "promise/no-promise-in-callback", "function done(err: Error | null) { if (err) throw err; return Promise.resolve(1); }\n")
}
