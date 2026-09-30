package linthost

import "testing"

// TestRuleCorpusUnicornPreferTernary verifies unicorn/prefer-ternary
// reports an if/else whose then- and else-branches each contain a
// single `return <expr>;`.
//
// The MVP only matches the return-statement shape (no assignment-rewrite
// path). This fixture pins that shape: both branches are blocks wrapping
// exactly one non-empty return so the single-return unwrap and the
// non-nil expression check stay covered.
//
// 1. Enable unicorn/prefer-ternary via an expect annotation.
// 2. Wrap the literal return in an if/else with single-return branches.
// 3. Assert the if-statement is reported.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies if and else immediately return two value alternatives; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/prefer-ternary annotation expresses its supported diagnostic policy; the separately authored accepted source has a literal zero-finding oracle, independent of product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; a ternary returns those two values directly. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornPreferTernary is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornPreferTernary(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-ternary.ts", "declare const cond: boolean;\nfunction f(): number {\n  // expect: unicorn/prefer-ternary error\n  if (cond) {\n    return 1;\n  } else {\n    return 2;\n  }\n}\nvoid f;\n")
  assertRuleSkipsSource(t, "unicorn/prefer-ternary", "declare const cond: boolean; function f(): number { return cond ? 1 : 2; }\n")
}
