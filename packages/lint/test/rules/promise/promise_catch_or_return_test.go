package linthost

import "testing"

// TestRuleCorpusPromiseCatchOrReturn verifies promise/catch-or-return reports
// a floating then chain without catch.
//
// This pins the expression-statement branch, where the chain is neither
// returned nor awaited and has no terminal rejection handler.
//
// 1. Enable promise/catch-or-return.
// 2. Use a top-level then chain without catch.
// 3. Assert the statement is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine rejects a bare then-chain expression without a terminal catch and permits returned or caught chains.
// @evidence contracts/testing.md#independent-expectations The annotation follows the chain ownership policy: an expression statement must handle rejection or pass the chain to its caller.
// @evidence contracts/testing.md#distinguishing-cases The original floating chain reports; the same chain with catch and a return-owned chain remain clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPromiseCatchOrReturn owns its annotated positive fixture and explicit clean control through assertRuleCorpusCase and assertRuleSkipsSource. The shared Go unit runner invokes Engine on parsed virtual source in one process; no installed consumer, native artifact build or product host is used.
func TestRuleCorpusPromiseCatchOrReturn(t *testing.T) {
  assertRuleCorpusCase(t, "promise/catch-or-return.ts", "// expect: promise/catch-or-return error\nPromise.resolve(1).then((value) => value + 1);\n")
  assertRuleSkipsSource(t, "promise/catch-or-return", "Promise.resolve(1).then(value => value).catch(error => console.error(error)); function f() { return Promise.resolve(1).then(value => value); }\n")
}
