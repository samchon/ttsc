package linthost

import "testing"

// TestRuleCorpusUnicornNoNull verifies unicorn/no-null reports a bare `null` literal.
//
// Every `null` literal flows through `KindNullKeyword`; visiting the kind once
// and reporting unconditionally is the rule's only behavior, so this fixture
// is both the minimal positive case and a guard that the engine still
// dispatches to bare-keyword visitors.
//
// 1. Enable unicorn/no-null via an expect annotation.
// 2. Declare a const initialized to the bare `null` literal.
// 3. Assert the literal is reported.
func TestRuleCorpusUnicornNoNull(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/no-null.ts", "// expect: unicorn/no-null error\nconst x = null;\n")
}
