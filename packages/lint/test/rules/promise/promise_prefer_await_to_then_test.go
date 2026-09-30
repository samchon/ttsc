package linthost

import "testing"

// TestRuleCorpusPromisePreferAwaitToThen verifies promise/prefer-await-to-then
// reports promise chain methods.
//
// The rule is intentionally syntax-only: any then/catch/finally chain is a
// candidate for async/await refactoring.
//
// 1. Enable promise/prefer-await-to-then.
// 2. Use a then chain.
// 3. Assert the chain call is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original then invocation without rejecting an awaited static Promise.resolve expression.
// @evidence contracts/testing.md#independent-expectations The syntax policy selects instance then/catch/finally chains as async-await candidates; the original annotation names that call site.
// @evidence contracts/testing.md#distinguishing-cases The original then reports; awaited static resolve stays clean, so the rule does not flag every Promise API use.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPromisePreferAwaitToThen owns its annotated positive fixture and explicit clean control through assertRuleCorpusCase and assertRuleSkipsSource. The shared Go unit runner invokes Engine on parsed virtual source in one process; no installed consumer, native artifact build or product host is used.
func TestRuleCorpusPromisePreferAwaitToThen(t *testing.T) {
  assertRuleCorpusCase(t, "promise/prefer-await-to-then.ts", "// expect: promise/prefer-await-to-then error\nPromise.resolve(1).then((value) => value);\n")
  assertRuleSkipsSource(t, "promise/prefer-await-to-then", "async function f() { await Promise.resolve(1); }\n")
}
