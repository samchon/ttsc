package linthost

import "testing"

// TestRuleCorpusPromiseAlwaysReturnReportsConditionalFallthrough verifies
// promise/always-return reports a then callback whose if branch can fall
// through without returning.
//
// Locks the callback-block control-flow branch. A descendant return inside an
// `if` body is not enough because the callback may take the implicit else path
// and resolve with undefined.
//
// 1. Enable promise/always-return.
// 2. Run a then callback whose only return is inside an if statement.
// 3. Assert the callback is reported.
//
// @evidence contracts/testing.md#behavioral-verification A then callback returns only in its if arm; the complete finding set requires the callback diagnostic when the other path falls through.
// @evidence contracts/testing.md#independent-expectations The authored expectation follows the policy that every path in a block-bodied then callback returns or throws, not the mere presence of a descendant return.
// @evidence contracts/testing.md#distinguishing-cases A two-arm returning if is clean; the original one-arm conditional stays reportable. TestRuleCorpusPromiseAlwaysReturn owns the no-return block.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusPromiseAlwaysReturnReportsConditionalFallthrough owns its annotated positive fixture and explicit clean control through assertRuleCorpusCase and assertRuleSkipsSource. The shared Go unit runner invokes Engine on parsed virtual source in one process; no installed consumer, native artifact build or product host is used.
func TestRuleCorpusPromiseAlwaysReturnReportsConditionalFallthrough(t *testing.T) {
  assertRuleCorpusCase(t, "promise/always-return-conditional-fallthrough.ts", "declare const ok: boolean;\n// expect: promise/always-return error\nPromise.resolve(1).then(() => {\n  if (ok) {\n    return 1;\n  }\n});\n")
  assertRuleSkipsSource(t, "promise/always-return", "Promise.resolve(1).then(() => { if (ok) { return 1; } else { return 2; } });\n")
}
