package linthost

import "testing"

// TestRuleCorpusNoUnsafeOptionalChaining verifies the lint rule corpus
// fixture no-unsafe-optional-chaining.ts.
//
// The rule fires on member access, element access, or call expressions
// whose receiver terminates in an optional `?.` operator without the
// outer access continuing the chain.
//
// 1. Load the annotated TypeScript source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comment.
// 3. Assert the native Engine reports exactly the annotated diagnostic.
func TestRuleCorpusNoUnsafeOptionalChaining(t *testing.T) {
	assertRuleCorpusCase(t, "no-unsafe-optional-chaining.ts", "declare const obj: { foo?: { bar: number } } | undefined;\n// expect: no-unsafe-optional-chaining error\nconst x = (obj?.foo).bar;\nJSON.stringify(x);\n")
}
