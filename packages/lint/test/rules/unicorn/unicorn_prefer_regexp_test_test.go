package linthost

import "testing"

// TestRuleCorpusUnicornPreferRegexpTest verifies
// unicorn/prefer-regexp-test reports `.match(/…/)` and `.exec(…)` calls
// that sit in a boolean position.
//
// The rule matches `match` / `exec` callees and walks the parent chain
// to confirm the call is consumed only for its truthiness — the
// condition slot of `if` / `?:`, the operand of `!`, or a side of the
// short-circuit operators. This fixture pins the `if`-condition arm
// with `String#match()` so the if-condition branch stays covered.
//
// 1. Enable unicorn/prefer-regexp-test via an expect annotation.
// 2. Use `"abc".match(/a/)` as an `if` condition.
// 3. Assert the call expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies String.match is used only for regex truthiness; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-regexp-test annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; RegExp.test directly answers the match predicate, while assigning and consuming match results retains the capture-producing call. All three source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferRegexpTest is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferRegexpTest(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-regexp-test.ts", "// expect: unicorn/prefer-regexp-test error\nif (\"abc\".match(/a/)) {\n  void 0;\n}\n")
  assertRuleSkipsSource(t, "unicorn/prefer-regexp-test", "if (/a/.test(\"abc\")) { void 0; }\n")
  assertRuleSkipsSource(t, "unicorn/prefer-regexp-test", "const matches = \"abc\".match(/(a)/); console.log(matches);\n")
}
