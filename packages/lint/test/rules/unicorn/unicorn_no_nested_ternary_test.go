package linthost

import "testing"

// TestRuleCorpusUnicornNoNestedTernary verifies unicorn/no-nested-ternary
// reports a ternary nested inside another ternary's else branch.
//
// The unicorn variant differs from core `no-nested-ternary`: it reports on
// the INNER conditional (so each nested level surfaces its own diagnostic)
// rather than only the outermost. The fixture pins that contract by placing
// the expect annotation immediately above the outer ternary; `stripParens`
// in `hasUnicornNestedConditional` makes the match parens-insensitive.
//
// 1. Enable unicorn/no-nested-ternary via an expect annotation.
// 2. Chain two ternaries through the else branch.
// 3. Assert the inner conditional is reported.
func TestRuleCorpusUnicornNoNestedTernary(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/no-nested-ternary.ts", "declare const x: number;\n// expect: unicorn/no-nested-ternary error\nconst r = x === 0 ? \"zero\" : x > 0 ? \"pos\" : \"neg\";\nJSON.stringify(r);\n")
}
