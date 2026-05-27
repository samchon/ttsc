package linthost

import "testing"

// TestRuleCorpusUnicornNoKeywordPrefix verifies unicorn/no-keyword-prefix
// reports a `let`/`const`-declared identifier that starts with `new` or
// `class` followed by an uppercase letter.
//
// The rule visits every `Identifier` but fires only on declaration name
// slots — the diagnostic should anchor on the introduction of the binding,
// not on every read. This fixture pins the variable-declaration arm.
//
// 1. Enable unicorn/no-keyword-prefix via an expect annotation.
// 2. Declare `const newFoo = 1` and read it once.
// 3. Assert the declaration name is reported (and the read is not).
func TestRuleCorpusUnicornNoKeywordPrefix(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/no-keyword-prefix.ts", "// expect: unicorn/no-keyword-prefix error\nconst newFoo = 1;\nvoid newFoo;\n")
}
