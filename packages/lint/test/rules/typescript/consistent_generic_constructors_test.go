package linthost

import "testing"

// TestRuleCorpusTypescriptConsistentGenericConstructors verifies the
// lint rule corpus fixture typescript-consistent-generic-constructors.ts.
//
// The rule fires when both the annotation and the `new` expression
// carry the same generic arguments. The diagnostic is attached to the
// constructor call.
//
// 1. Load the annotated TypeScript source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comment.
// 3. Assert the native Engine reports exactly the annotated diagnostic.
func TestRuleCorpusTypescriptConsistentGenericConstructors(t *testing.T) {
  assertRuleCorpusCase(t, "typescript-consistent-generic-constructors.ts", "// expect: typescript/consistent-generic-constructors error\nconst m: Map<string, number> = new Map<string, number>();\nJSON.stringify(m);\n")
}
