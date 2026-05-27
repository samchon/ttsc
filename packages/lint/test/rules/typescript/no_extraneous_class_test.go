package linthost

import "testing"

// TestRuleCorpusTypescriptNoExtraneousClass verifies the lint rule
// corpus fixture typescript-no-extraneous-class.ts.
//
// The rule fires on classes without `extends`/`implements` whose body
// is empty or contains only static members and trivial constructors.
//
// 1. Load the annotated TypeScript source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comment.
// 3. Assert the native Engine reports exactly the annotated diagnostic.
func TestRuleCorpusTypescriptNoExtraneousClass(t *testing.T) {
	assertRuleCorpusCase(t, "typescript-no-extraneous-class.ts", "// expect: typescript/no-extraneous-class error\nclass StaticOnly {\n  static factory(): number {\n    return 1;\n  }\n}\nJSON.stringify(StaticOnly);\n")
}
