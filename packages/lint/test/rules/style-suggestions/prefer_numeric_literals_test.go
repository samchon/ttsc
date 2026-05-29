package linthost

import "testing"

// TestRuleCorpusPreferNumericLiterals verifies the lint rule corpus
// fixture prefer-numeric-literals.ts.
//
// The rule fires on `parseInt(literal, 2 | 8 | 16)` calls; the
// recommended replacement is the ES2015+ numeric literal form (`0b…`,
// `0o…`, `0x…`).
//
// 1. Load the annotated TypeScript source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comment.
// 3. Assert the native Engine reports exactly the annotated diagnostic.
func TestRuleCorpusPreferNumericLiterals(t *testing.T) {
  assertRuleCorpusCase(t, "prefer-numeric-literals.ts", "// expect: prefer-numeric-literals error\nconst hex = parseInt(\"ff\", 16);\nJSON.stringify(hex);\n")
}
