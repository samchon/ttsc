package linthost

import "testing"

// TestRuleCorpusUnicornNoArrayReverse verifies unicorn/no-array-reverse
// reports a zero-argument `.reverse()` call on an array literal.
//
// The rule matches the method name plus an empty argument list — the
// shape that maps cleanly onto `Array#toReversed()`. This fixture pins
// that exact positive case so the zero-args guard isn't loosened by
// accident in later refactors.
//
// 1. Enable unicorn/no-array-reverse.
// 2. Call `.reverse()` on an inline array literal.
// 3. Assert the call expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies reverse mutates its array receiver; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-array-reverse annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; toReversed retains reverse ordering without mutation. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoArrayReverse is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoArrayReverse(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-array-reverse.ts", "// expect: unicorn/no-array-reverse error\nconst r = [1, 2, 3].reverse();\n")
  assertRuleSkipsSource(t, "unicorn/no-array-reverse", "const r = [1, 2, 3].toReversed();\n")
}
