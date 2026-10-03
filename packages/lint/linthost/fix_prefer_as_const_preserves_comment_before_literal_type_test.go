package linthost

import "testing"

// TestFixPreferAsConstPreservesCommentBeforeLiteralType verifies the preferAsConst fixer keeps adjacent comments.
//
// The TextEdit anchors on tokenRange, which skips the literal type's leading
// trivia. A comment between `as` and the literal type therefore sits outside
// the replaced span and must survive the rewrite; an edit anchored on the
// node's trivia-inclusive Pos would swallow it.
//
// 1. Parse a source file with `"literal" as /* keep */ "literal"`.
// 2. Apply the preferAsConst finding through the disk-backed fixer.
// 3. Assert the comment survives and only the type became `const`.
//
// @evidence contracts/testing.md#behavioral-verification prefer-as-const replaces the literal type after as without swallowing its leading comment.
// @evidence contracts/testing.md#independent-expectations The literal as /* keep */ const result preserves the comment and expression independently of token anchoring.
// @evidence contracts/testing.md#distinguishing-cases Leading trivia sits outside the replaced type token; plain and parenthesized assertion cases complement this boundary.
// @evidence contracts/testing.md#execution-ownership TestFixPreferAsConstPreservesCommentBeforeLiteralType uses assertFixSnapshot for typescript/prefer-as-const.
func TestFixPreferAsConstPreservesCommentBeforeLiteralType(t *testing.T) {
  assertFixSnapshot(
    t,
    "typescript/prefer-as-const",
    "const value = \"literal\" as /* keep */ \"literal\";\nJSON.stringify(value);\n",
    "const value = \"literal\" as /* keep */ const;\nJSON.stringify(value);\n",
  )
}
