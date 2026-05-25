package linthost

import "testing"

// TestFormatTrailingCommaSkipsInlineBlockCommentBeforeCloseBracket verifies
// the rule leaves the trailing comma off when a block comment sits between
// the last element and the close bracket on the SAME physical line.
//
// `node.End()` in TypeScript-Go excludes trailing trivia, so a block comment
// inlined between the last element and `]` lives inside the leading trivia
// of the next token. When the comment shares a line with the close bracket,
// `last.End()..closeBracketPos` contains no `\n` and the rule must skip —
// matching prettier's `ifBreak(",")` semantics, which key the trailing
// comma on group break (close bracket on its own line), not on internal
// newlines. Pinning this branch protects the trivia-exclusion invariant
// from a future tsgo `nodePos()` semantic drift that would silently widen
// the skip beyond same-line close-bracket shapes.
//
//  1. Parse a source file with one multi-line array literal whose last
//     element is followed by an inline block comment and `]` on the same
//     line.
//  2. Run the engine with formatTrailingComma enabled.
//  3. Assert zero findings.
func TestFormatTrailingCommaSkipsInlineBlockCommentBeforeCloseBracket(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/trailing-comma",
    "const xs = [\n  1,\n  2/* note */];\n",
  )
}
