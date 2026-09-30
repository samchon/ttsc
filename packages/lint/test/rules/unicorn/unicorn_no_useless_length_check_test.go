package linthost

import "testing"

// TestRuleCorpusUnicornNoUselessLengthCheck verifies the rule reports
// `xs.length > 0 && xs.some(...)` where the length guard is redundant.
//
// The rule pairs an `X.length > 0` LHS with a `X.some(...)` RHS that
// already returns `false` for an empty array, so the leading length
// check changes nothing. `every`, `map`, and `filter` are intentionally
// excluded from the `&&` set because their empty-array return values
// (true / empty array) DO make the length check load-bearing.
//
// 1. Enable unicorn/no-useless-length-check via an expect annotation.
// 2. Compose `xs.length > 0 && xs.some((x) => x > 0)`.
// 3. Assert the binary expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies some is guarded by a redundant positive-length check; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-useless-length-check annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; some is used directly because it handles empty arrays. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoUselessLengthCheck is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoUselessLengthCheck(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-useless-length-check.ts", "declare const xs: number[];\n// expect: unicorn/no-useless-length-check error\nconst any = xs.length > 0 && xs.some((x) => x > 0);\nvoid any;\n")
  assertRuleSkipsSource(t, "unicorn/no-useless-length-check", "declare const xs: number[]; const any = xs.some(x => x > 0);\n")
}
