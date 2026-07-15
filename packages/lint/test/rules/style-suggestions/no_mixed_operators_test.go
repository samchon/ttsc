package linthost

import "testing"

// TestRuleCorpusNoMixedOperators verifies the lint rule corpus fixture no-mixed-operators.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-mixed-operators.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusNoMixedOperators(t *testing.T) {
  assertRuleCorpusCase(t, "no-mixed-operators.ts", "declare const a: any;\ndeclare const b: any;\ndeclare const c: any;\ndeclare const d: any;\n\n// Logical mixed with a different logical: `&&` binds tighter than `||`.\n// expect: no-mixed-operators error\nconst m1 = a && b || c;\n\n// expect: no-mixed-operators error\nconst m2 = a || b && c;\n\n// Arithmetic mixing is in the default group: `*` binds tighter than `+`.\n// expect: no-mixed-operators error\nconst m3 = a + b * c;\n\n// Bitwise next to logical is a cross-group pair ESLint never flags.\nconst ok1 = a | b && c;\n\n// Inner expression is parenthesized — author acknowledged the grouping.\nconst ok2 = (a && b) || c;\n\n// Same operator chain — no confusion.\nconst ok3 = a && b && c && d;\n\n// Same precedence inside the arithmetic group is allowed by default.\nconst ok4 = a + b - c;\n\nJSON.stringify([m1, m2, m3, ok1, ok2, ok3, ok4]);\n")
}
