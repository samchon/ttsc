package linthost

import "testing"

// TestRuleCorpusUnicornRequirePostMessageTargetOrigin verifies
// unicorn/require-post-message-target-origin reports a
// single-argument `.postMessage(payload)` call.
//
// The rule visits every `CallExpression` and matches purely on the
// property-access callee's method name plus the one-arg shape (the
// missing `targetOrigin` is what the rule blames). A `declare const`
// receiver typed as `Window` lets the call parse without dragging the
// DOM lib in.
//
// 1. Enable unicorn/require-post-message-target-origin via an expect annotation.
// 2. Call `.postMessage(...)` on a Window receiver with one argument.
// 3. Assert the call expression is reported.
func TestRuleCorpusUnicornRequirePostMessageTargetOrigin(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/require-post-message-target-origin.ts", "declare const win: Window;\n// expect: unicorn/require-post-message-target-origin error\nwin.postMessage({ kind: \"ping\" });\n")
}
