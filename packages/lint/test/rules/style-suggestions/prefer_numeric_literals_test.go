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
//
// @evidence contracts/testing.md#behavioral-verification Reports parseInt of a static hexadecimal string/base while allowing the explicit numeric literal.
// @evidence contracts/testing.md#independent-expectations Static ff base sixteen is expressible as 0xff; independent literal source and annotation establish old/new syntax expectations.
// @evidence contracts/testing.md#distinguishing-cases Static conversion positive and modern numeric literal control preserve the value without claiming dynamic parseInt can be replaced.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase owns the original annotated engine fixture; assertRuleSkipsSource owns the authored modern-syntax control. Both assertions execute under this discoverable Test entry. Execution stays in the lint Go process without consumer installation or native product-host builds/launches.
func TestRuleCorpusPreferNumericLiterals(t *testing.T) {
  assertRuleCorpusCase(t, "prefer-numeric-literals.ts", "// expect: prefer-numeric-literals error\nconst hex = parseInt(\"ff\", 16);\nJSON.stringify(hex);\n")
  assertRuleSkipsSource(t, "prefer-numeric-literals", "const value = 0xff;\n")
}
