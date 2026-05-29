package linthost

import "testing"

// TestRuleCorpusUnicornPreferObjectFromEntries verifies
// unicorn/prefer-object-from-entries reports `.reduce(reducer, {})`.
//
// The fixture pins the canonical empty-object-seed shape — a two-argument
// `.reduce` whose second argument is `{}` — because the reducer body is
// intentionally not inspected: any `.reduce(_, {})` is, in practice, a
// from-entries pattern. A small typed entry array keeps the AST shape
// clear without dragging in helper types.
//
// 1. Enable unicorn/prefer-object-from-entries via an expect annotation.
// 2. Declare `const obj = entries.reduce(reducer, {});`.
// 3. Assert the call expression is reported.
func TestRuleCorpusUnicornPreferObjectFromEntries(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-object-from-entries.ts", "const entries: Array<[string, number]> = [[\"a\", 1]];\n// expect: unicorn/prefer-object-from-entries error\nconst obj = entries.reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});\nvoid obj;\n")
}
