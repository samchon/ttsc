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
func TestRuleCorpusPromiseAlwaysReturnReportsConditionalFallthrough(t *testing.T) {
	assertRuleCorpusCase(t, "promise/always-return-conditional-fallthrough.ts", "declare const ok: boolean;\n// expect: promise/always-return error\nPromise.resolve(1).then(() => {\n  if (ok) {\n    return 1;\n  }\n});\n")
}
