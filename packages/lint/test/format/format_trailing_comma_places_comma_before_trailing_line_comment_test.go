package linthost

import "testing"

// TestFormatTrailingCommaPlacesCommaBeforeTrailingLineComment verifies
// the rule inserts the trailing comma BEFORE a trailing `//` line comment
// on the last element of a multi-line list, not after it.
//
// `node.End()` excludes trailing trivia, so `last.End()` lands right after the
// element's last code byte regardless of whether a `//` comment follows on the
// same line. The rule inserts at `last.End()`, which places the comma between
// the element and the line comment — matching prettier's `trailingComma: "all"`
// behavior verbatim (`"value", // note\n]`). Pinning this case anchors both
// the trivia-excluded `node.End()` invariant and the prettier-parity
// comma-before-line-comment placement, so a future tsgo `nodePos()` semantic
// drift would wedge the rule visibly instead of producing a syntactically
// valid but stylistically wrong rewrite.
//
//  1. Parse a source file with one multi-line array whose last element carries
//     a trailing `// trailing` comment.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the rewritten file places the comma BEFORE the line comment.
func TestFormatTrailingCommaPlacesCommaBeforeTrailingLineComment(t *testing.T) {
  assertFixSnapshot(
    t,
    "formatTrailingComma",
    "const xs = [\n  1,\n  2 // trailing\n];\n",
    "const xs = [\n  1,\n  2, // trailing\n];\n",
  )
}
