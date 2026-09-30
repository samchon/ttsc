package linthost

import "testing"

// TestRuleCorpusUnicornNoUnreadableArrayDestructuring verifies
// unicorn/no-unreadable-array-destructuring reports a destructuring
// pattern with four leading hole positions before the bound name.
//
// The rule fires when a consecutive run of two or more
// `OmittedExpression` holes is followed by a real element. Four leading
// commas are the canonical worst case from the upstream rule — the
// reader has to count to know which array index `a` reads.
//
//  1. Enable unicorn/no-unreadable-array-destructuring via an expect
//     annotation.
//  2. Destructure `[, , , , a]` out of a 5-element array literal.
//  3. Assert the binding pattern is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies four leading holes obscure the selected element; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-unreadable-array-destructuring annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; one leading hole remains accepted, while two and three consecutive holes and the original four-hole input report. All four source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoUnreadableArrayDestructuring is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoUnreadableArrayDestructuring(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-unreadable-array-destructuring.ts", "// expect: unicorn/no-unreadable-array-destructuring error\nconst [, , , , a] = [1, 2, 3, 4, 5];\nvoid a;\n")
  assertRuleSkipsSource(t, "unicorn/no-unreadable-array-destructuring", "const [, a] = [1,2]; void a;\n")
  assertRuleCorpusCase(t, "unicorn/no-unreadable-array-destructuring-two-holes.ts", "// expect: unicorn/no-unreadable-array-destructuring error\nconst [, , a] = [1,2,3]; void a;\n")
  assertRuleCorpusCase(t, "unicorn/no-unreadable-array-destructuring-threshold.ts", "// expect: unicorn/no-unreadable-array-destructuring error\nconst [, , , a] = [1,2,3,4]; void a;\n")
}
