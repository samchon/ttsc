package linthost

import "testing"

// TestRuleCorpusPromiseAlwaysReturn verifies promise/always-return reports a
// then callback that neither returns nor throws.
//
// The promise plugin family is namespaced, so this also pins slash-bearing
// expectation parsing in the Go corpus harness.
//
// 1. Enable the namespaced promise rule through an expect annotation.
// 2. Run a then callback with a block body and no return.
// 3. Assert the callback is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the block-bodied then callback that performs only a console side effect, retaining the namespaced error and exact line.
// @evidence contracts/testing.md#independent-expectations The authored annotation requires a return or throw on all callback paths; console output alone does not settle the callback with an explicit return.
// @evidence contracts/testing.md#distinguishing-cases Returning and throwing callbacks are clean controls, while the original side-effect-only callback reports. The conditional fallthrough test owns partial returns.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPromiseAlwaysReturn owns its annotated positive fixture and explicit clean control through assertRuleCorpusCase and assertRuleSkipsSource. The shared Go unit runner invokes Engine on parsed virtual source in one process; no installed consumer, native artifact build or product host is used.
func TestRuleCorpusPromiseAlwaysReturn(t *testing.T) {
  assertRuleCorpusCase(t, "promise/always-return.ts", "// expect: promise/always-return error\nPromise.resolve(1).then(() => {\n  console.log(\"side effect\");\n});\n")
  assertRuleSkipsSource(t, "promise/always-return", "Promise.resolve(1).then(() => { return 1; }); Promise.resolve(1).then(() => { throw new Error(); });\n")
}
