package linthost

import "testing"

// TestRuleCorpusUnicornNoNegatedCondition verifies the rule reports an
// `if (x !== 0) { … } else { … }` with a negated condition.
//
// The matcher fires when the condition uses a `!==` (or `!=` or `!`) operator
// AND the statement has both a then- and an else-branch — inverting and
// swapping the branches reads in source order. This fixture pins the
// `!==` if/else arm.
//
// 1. Enable unicorn/no-negated-condition via an expect annotation.
// 2. Pair `if (x !== 0)` with an `else` branch.
// 3. Assert the if-statement is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies a negated condition chooses between both if and else arms; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-negated-condition annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; a positive condition chooses those arms. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoNegatedCondition is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoNegatedCondition(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-negated-condition.ts", "declare const x: number;\n// expect: unicorn/no-negated-condition error\nif (x !== 0) {\n  void \"nonzero\";\n} else {\n  void \"zero\";\n}\n")
  assertRuleSkipsSource(t, "unicorn/no-negated-condition", "declare const x: number; if (x === 0) { void \"zero\"; } else { void \"nonzero\"; }\n")
}
