package linthost

import "testing"

// TestRuleCorpusPromiseValidParams verifies promise/valid-params reports wrong
// argument counts for Promise APIs.
//
// Promise.all requires one iterable argument, so an empty call is always
// suspicious and can be detected without type information.
//
// 1. Enable promise/valid-params.
// 2. Call Promise.all with no arguments.
// 3. Assert the invalid call is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine rejects the original zero-argument Promise.all while accepting its one iterable argument.
// @evidence contracts/testing.md#independent-expectations The Promise.all call contract requires one iterable argument; the authored empty-call annotation is independent of rule output.
// @evidence contracts/testing.md#distinguishing-cases The zero-argument call reports; one iterable argument and resolve with zero or one argument stay clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPromiseValidParams owns its annotated positive fixture and explicit clean control through assertRuleCorpusCase and assertRuleSkipsSource. The shared Go unit runner invokes Engine on parsed virtual source in one process; no installed consumer, native artifact build or product host is used.
func TestRuleCorpusPromiseValidParams(t *testing.T) {
  assertRuleCorpusCase(t, "promise/valid-params.ts", "// expect: promise/valid-params error\nPromise.all();\n")
  assertRuleSkipsSource(t, "promise/valid-params", "Promise.all([]); Promise.resolve(); Promise.resolve(1);\n")
}
