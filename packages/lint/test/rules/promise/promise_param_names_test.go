package linthost

import "testing"

// TestRuleCorpusPromiseParamNames verifies promise/param-names reports
// misnamed Promise executor parameters.
//
// The first parameter is canonical so the test isolates the reject-name branch.
//
// 1. Enable promise/param-names.
// 2. Name the second executor parameter `fail`.
// 3. Assert the second parameter is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine isolates the second executor parameter fail while preserving the correctly named resolve parameter.
// @evidence contracts/testing.md#independent-expectations The conventional resolve/reject executor parameter contract establishes the authored second-parameter diagnostic independently of AST output.
// @evidence contracts/testing.md#distinguishing-cases The original fail parameter reports; canonical and underscore-prefixed resolve/reject pairs stay clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPromiseParamNames owns its annotated positive fixture and explicit clean control through assertRuleCorpusCase and assertRuleSkipsSource. The shared Go unit runner invokes Engine on parsed virtual source in one process; no installed consumer, native artifact build or product host is used.
func TestRuleCorpusPromiseParamNames(t *testing.T) {
  assertRuleCorpusCase(t, "promise/param-names.ts", "new Promise((resolve,\n  // expect: promise/param-names error\n  fail) => fail(new Error(\"x\")));\n")
  assertRuleSkipsSource(t, "promise/param-names", "new Promise((resolve, reject) => resolve(1)); new Promise((_resolve, _reject) => _resolve(1));\n")
}
