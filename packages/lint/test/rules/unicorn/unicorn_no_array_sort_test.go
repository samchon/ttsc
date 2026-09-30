package linthost

import "testing"

// TestRuleCorpusUnicornNoArraySort verifies unicorn/no-array-sort reports
// a zero-argument `.sort()` call on an array literal.
//
// `sort` accepts an optional comparator (zero or one arg); the canonical
// no-comparator shape pins the diagnostic and exercises the upper-bound
// argument guard's lower branch without introducing comparator-shape
// noise.
//
// 1. Enable unicorn/no-array-sort.
// 2. Call `.sort()` on an inline array literal.
// 3. Assert the call expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies sort mutates its array receiver; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-array-sort annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; toSorted retains ordering without mutation. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoArraySort is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoArraySort(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-array-sort.ts", "// expect: unicorn/no-array-sort error\nconst s = [3, 1, 2].sort();\n")
  assertRuleSkipsSource(t, "unicorn/no-array-sort", "const s = [3, 1, 2].toSorted();\n")
}
