package linthost

import "testing"

// TestRuleCorpusUnicornEmptyBraceSpaces verifies unicorn/empty-brace-spaces
// reports an empty object literal containing whitespace between its braces.
//
// The rule visits both Block and ObjectLiteralExpression and fires when the
// node is empty and the source-text region between the open and close braces
// contains at least one whitespace byte. This fixture exercises the object
// literal arm with a single space between the braces.
//
// 1. Enable unicorn/empty-brace-spaces via an expect annotation.
// 2. Declare an object literal with whitespace between its braces.
// 3. Assert the object literal expression is reported.
func TestRuleCorpusUnicornEmptyBraceSpaces(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/empty-brace-spaces.ts", "// expect: unicorn/empty-brace-spaces error\nconst o = { };\n")
}
