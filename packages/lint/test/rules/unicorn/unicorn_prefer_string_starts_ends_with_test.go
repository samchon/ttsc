package linthost

import "testing"

// TestRuleCorpusUnicornPreferStringStartsEndsWith verifies
// unicorn/prefer-string-starts-ends-with reports the `s.slice(0, N) === "..."`
// shape.
//
// The rule walks the binary expression and matches either side carrying a
// `slice(0, N)` (or `slice(-N)`) call paired with a string literal whose length
// equals N. This fixture pins the canonical `startsWith` arm: a four-byte
// literal compared against `slice(0, 4)`.
//
// 1. Enable unicorn/prefer-string-starts-ends-with via an expect annotation.
// 2. Compare `s.slice(0, 4)` against `"http"`.
// 3. Assert the binary expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies slice and equality manually test a prefix; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-string-starts-ends-with annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; startsWith directly tests that prefix. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferStringStartsEndsWith is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferStringStartsEndsWith(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-string-starts-ends-with.ts", "declare const s: string;\n// expect: unicorn/prefer-string-starts-ends-with error\nconst b = s.slice(0, 4) === \"http\";\n")
  assertRuleSkipsSource(t, "unicorn/prefer-string-starts-ends-with", "declare const s: string; const b = s.startsWith(\"http\");\n")
}
