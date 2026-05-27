package linthost

import "testing"

// TestRuleCorpusNoNewSymbol verifies the lint rule corpus fixture
// no-new-symbol.ts.
//
// `Symbol` is a function but not a constructor; calling it with `new`
// throws a TypeError at runtime.
//
// 1. Load the annotated TypeScript source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comment.
// 3. Assert the native Engine reports exactly the annotated diagnostic.
func TestRuleCorpusNoNewSymbol(t *testing.T) {
	assertRuleCorpusCase(t, "no-new-symbol.ts", "// expect: no-new-symbol error\nconst bad = new Symbol(\"desc\");\nJSON.stringify(bad);\n")
}
