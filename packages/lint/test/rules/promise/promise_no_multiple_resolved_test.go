package linthost

import "testing"

// TestRuleCorpusPromiseNoMultipleResolved verifies promise/no-multiple-resolved
// reports a second resolver call in one Promise executor.
//
// The native implementation is intentionally syntactic and catches the
// high-confidence straight-line case.
//
// 1. Enable promise/no-multiple-resolved.
// 2. Call resolve and then reject in the same executor body.
// 3. Assert the second resolver call is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the second resolve/reject call in the original executor rather than suppressing repeated settlement attempts.
// @evidence contracts/testing.md#independent-expectations The fixed expectation identifies the second resolver call under the straight-line multiple-settlement policy; it is not computed by walking the tested AST.
// @evidence contracts/testing.md#distinguishing-cases The resolve-then-reject input reports; an executor with one resolve and no settlement remain clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPromiseNoMultipleResolved owns its annotated positive fixture and explicit clean control through assertRuleCorpusCase and assertRuleSkipsSource. The shared Go unit runner invokes Engine on parsed virtual source in one process; no installed consumer, native artifact build or product host is used.
func TestRuleCorpusPromiseNoMultipleResolved(t *testing.T) {
  assertRuleCorpusCase(t, "promise/no-multiple-resolved.ts", "new Promise((resolve, reject) => {\n  resolve(1);\n  // expect: promise/no-multiple-resolved error\n  reject(new Error(\"already resolved\"));\n});\n")
  assertRuleSkipsSource(t, "promise/no-multiple-resolved", "new Promise((resolve, reject) => { resolve(1); }); new Promise((resolve, reject) => {});\n")
}
