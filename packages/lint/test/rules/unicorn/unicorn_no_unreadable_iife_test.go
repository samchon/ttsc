package linthost

import "testing"

// TestRuleCorpusUnicornNoUnreadableIife verifies the rule reports an IIFE
// whose arrow body is itself a call expression.
//
// `(() => Math.random())()` is two layers of invocation for one
// effective call — the inner call site is hidden behind an anonymous
// arrow. The rule visits `KindCallExpression`, requires the callee to
// be a `KindParenthesizedExpression` wrapping a `KindArrowFunction`,
// and requires the arrow's body to be itself a `KindCallExpression`.
// The fixture pins that exact arrow→call shape.
//
// 1. Enable unicorn/no-unreadable-iife via an expect annotation.
// 2. Assign `(() => Math.random())()` to a const.
// 3. Assert the outer call is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies a compact expression-bodied arrow is invoked immediately; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-unreadable-iife annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; a named function call avoids the immediate arrow expression. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoUnreadableIife is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoUnreadableIife(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-unreadable-iife.ts", "// expect: unicorn/no-unreadable-iife error\nconst r = (() => Math.random())();\nvoid r;\n")
  assertRuleSkipsSource(t, "unicorn/no-unreadable-iife", "function draw() { return Math.random(); } const r = draw();\n")
}
