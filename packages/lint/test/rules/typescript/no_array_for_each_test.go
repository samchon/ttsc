package linthost

import "testing"

// TestRuleCorpusTypescriptNoArrayForEach verifies the lint rule corpus
// fixture typescript-no-array-for-each.ts.
//
// The rule fires on any `.forEach(...)` call by syntactic shape; the
// receiver type is not consulted (matching upstream).
//
// 1. Load the annotated TypeScript source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comment.
// 3. Assert the native Engine reports exactly the annotated diagnostic.
func TestRuleCorpusTypescriptNoArrayForEach(t *testing.T) {
	assertRuleCorpusCase(t, "typescript-no-array-for-each.ts", "// expect: typescript/no-array-for-each error\n[1, 2, 3].forEach((value) => {\n  JSON.stringify(value);\n});\n")
}
