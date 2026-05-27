package linthost

import "testing"

// TestRuleCorpusTypescriptNoInvalidVoidType verifies the lint rule
// corpus fixture typescript-no-invalid-void-type.ts.
//
// The rule fires on `void` used as a union constituent or as a
// non-allow-listed generic argument. `Promise<void>`, function return
// types, and `void X` expressions are all valid positions.
//
// 1. Load the annotated TypeScript source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comment.
// 3. Assert the native Engine reports exactly the annotated diagnostic.
func TestRuleCorpusTypescriptNoInvalidVoidType(t *testing.T) {
	assertRuleCorpusCase(t, "typescript-no-invalid-void-type.ts", "// expect: typescript/no-invalid-void-type error\ntype Result = string | void;\nJSON.stringify({} as Result);\n")
}
