package linthost

import "testing"

// TestRuleCorpusUnicornPreferDateNow verifies unicorn/prefer-date-now
// reports `new Date().getTime()`.
//
// The rule covers three shapes — `.getTime()`, `.valueOf()`, and
// `+new Date()`. The fixture pins the `.getTime()` shape, which
// exercises the CallExpression → PropertyAccess → NewExpression
// walk that the other call-form shares.
//
// 1. Enable unicorn/prefer-date-now via an expect annotation.
// 2. Declare a const initialized to `new Date().getTime()`.
// 3. Assert the call expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies new Date is allocated solely to read its current timestamp; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-date-now annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; Date.now produces the timestamp without allocation. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferDateNow is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferDateNow(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-date-now.ts", "// expect: unicorn/prefer-date-now error\nconst t = new Date().getTime();\n")
  assertRuleSkipsSource(t, "unicorn/prefer-date-now", "const t = Date.now();\n")
}
