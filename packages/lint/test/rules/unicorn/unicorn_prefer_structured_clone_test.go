package linthost

import "testing"

// TestRuleCorpusUnicornPreferStructuredClone verifies the rule reports
// `JSON.parse(JSON.stringify(x))`.
//
// The nested-call gate is the entire rule: outer `JSON.parse(...)`
// whose single argument is `JSON.stringify(...)`. A plain object
// literal as the inner argument exercises the positive shape without
// pulling in any other surface.
//
// 1. Enable unicorn/prefer-structured-clone via an expect annotation.
// 2. Round-trip an object through `JSON.parse(JSON.stringify(original))`.
// 3. Assert the outer call expression is reported.
func TestRuleCorpusUnicornPreferStructuredClone(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/prefer-structured-clone.ts", "const original = { a: 1 };\n// expect: unicorn/prefer-structured-clone error\nconst clone = JSON.parse(JSON.stringify(original));\n")
}
