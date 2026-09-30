package linthost

import "testing"

// TestRuleCorpusUnicornNoNewArray verifies unicorn/no-new-array reports
// `new Array(...)` constructions.
//
// The single-numeric-argument form is the most common offender: it allocates
// a sparse array rather than a one-element array, which is the entire reason
// the upstream rule exists. The match is callee-identifier-text only, so
// argument count and type are not part of the contract.
//
// 1. Enable unicorn/no-new-array via an expect annotation.
// 2. Construct `new Array(3)` at the top level.
// 3. Assert the new-expression is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies new Array creates a length-sensitive array constructor result; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-new-array annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; an array literal expresses explicit elements. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoNewArray is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoNewArray(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-new-array.ts", "// expect: unicorn/no-new-array error\nconst a = new Array(3);\n")
  assertRuleSkipsSource(t, "unicorn/no-new-array", "const a = [1, 2, 3];\n")
}
