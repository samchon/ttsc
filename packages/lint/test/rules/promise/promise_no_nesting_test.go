package linthost

import "testing"

// TestRuleCorpusPromiseNoNesting verifies promise/no-nesting reports nested
// promise chains inside promise callbacks.
//
// The case keeps the outer and inner chains on separate lines so the reported
// nested call is unambiguous.
//
// 1. Enable promise/no-nesting.
// 2. Nest a then chain inside another then handler.
// 3. Assert the inner chain is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the inner then chain in the original outer promise callback and permits a top-level chain.
// @evidence contracts/testing.md#independent-expectations The annotated inner call belongs to a promise callback and violates the no-nesting policy independently of Engine traversal.
// @evidence contracts/testing.md#distinguishing-cases Nested then reports; an isolated then at top level stays clean. The original fixture keeps outer and inner lines distinct.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPromiseNoNesting owns its annotated positive fixture and explicit clean control through assertRuleCorpusCase and assertRuleSkipsSource. The shared Go unit runner invokes Engine on parsed virtual source in one process; no installed consumer, native artifact build or product host is used.
func TestRuleCorpusPromiseNoNesting(t *testing.T) {
  assertRuleCorpusCase(t, "promise/no-nesting.ts", "Promise.resolve(1).then(() => {\n  // expect: promise/no-nesting error\n  Promise.resolve(2).then((value) => value);\n});\n")
  assertRuleSkipsSource(t, "promise/no-nesting", "Promise.resolve(1).then(value => value);\n")
}
