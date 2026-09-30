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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies postMessage omits its target-origin argument; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/require-post-message-target-origin annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; postMessage explicitly names the permitted origin. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornRequirePostMessageTargetOrigin is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornRequirePostMessageTargetOrigin(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/require-post-message-target-origin.ts", "declare const win: Window;\n// expect: unicorn/require-post-message-target-origin error\nwin.postMessage({ kind: \"ping\" });\n")
  assertRuleSkipsSource(t, "unicorn/require-post-message-target-origin", "declare const win: Window; win.postMessage({ kind: \"ping\" }, \"https://example.com\");\n")
}
