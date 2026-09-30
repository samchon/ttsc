package linthost

import "testing"

// TestRuleCorpusUnicornNoArrayReduce verifies unicorn/no-array-reduce
// reports a direct `.reduce(...)` call on an array literal.
//
// `reduce` and `reduceRight` share the same method-name branch in the
// rule; the canonical positive case exercises the `reduce` arm and is
// enough to pin the diagnostic against accidental regression of the
// method-name allowlist.
//
// 1. Enable unicorn/no-array-reduce.
// 2. Sum an array literal with `.reduce`.
// 3. Assert the call expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies reduce expresses a fold instead of explicit iteration; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-array-reduce annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; explicit iteration accumulates the same sum without reduce. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoArrayReduce is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoArrayReduce(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-array-reduce.ts", "// expect: unicorn/no-array-reduce error\nconst total = [1, 2, 3].reduce((a, b) => a + b, 0);\n")
  assertRuleSkipsSource(t, "unicorn/no-array-reduce", "let total = 0; for (const x of [1, 2, 3]) { total += x; }\n")
}
