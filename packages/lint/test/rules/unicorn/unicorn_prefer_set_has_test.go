package linthost

import "testing"

// TestRuleCorpusUnicornPreferSetHas verifies unicorn/prefer-set-has reports
// `[…].includes(x)` against a literal array receiver.
//
// The minimum-viable port only flags literal-array receivers — the upstream
// rule additionally reasons about typed variable receivers, which needs type
// flow analysis out of scope for this slice. This fixture pins the literal arm
// so the typed-variable expansion has an obvious baseline to extend.
//
// 1. Enable unicorn/prefer-set-has via an expect annotation.
// 2. Call `.includes(x)` on an inline array literal.
// 3. Assert the call expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies a literal array is used for membership lookup; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-set-has annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; a Set supplies the supported has lookup. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferSetHas is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferSetHas(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-set-has.ts", "const x = 2;\n// expect: unicorn/prefer-set-has error\nconst found = [1, 2, 3].includes(x);\n")
  assertRuleSkipsSource(t, "unicorn/prefer-set-has", "const x = 2; const found = new Set([1,2,3]).has(x);\n")
}
