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
func TestRuleCorpusUnicornPreferTernary(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/prefer-ternary.ts", "declare const cond: boolean;\nfunction f(): number {\n  // expect: unicorn/prefer-ternary error\n  if (cond) {\n    return 1;\n  } else {\n    return 2;\n  }\n}\nvoid f;\n")
}
