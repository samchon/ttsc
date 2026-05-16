package linthost

import "testing"

// TestFormatPrintWidthPreservesLeadingJSDocAboveReflowedNode verifies
// the rule does not touch leading JSDoc that sits above the reflowed
// node.
//
// The rule's edit range starts at `shimscanner.SkipTrivia(node.Pos())`
// — leading trivia is intentionally outside the replaced range.
// A future refactor that swapped `SkipTrivia` for the raw `node.Pos()`
// would silently swallow JSDoc and any other leading comments. The
// case pins this guarantee with a JSDoc block above a reflow target.
//
//  1. Configure printWidth=20.
//  2. Feed `/** doc */\nconst x = { aaaa: 1, bbbb: 2, cccc: 3 };` —
//     the object literal would reflow regardless of the comment.
//  3. Assert the JSDoc survives in the output, sitting above the
//     reflowed declaration.
func TestFormatPrintWidthPreservesLeadingJSDocAboveReflowedNode(t *testing.T) {
  src := "/** doc */\nconst x = { aaaa: 1, bbbb: 2, cccc: 3 };\n"
  want := "/** doc */\nconst x = {\n  aaaa: 1,\n  bbbb: 2,\n  cccc: 3,\n};\n"
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    src,
    `{"printWidth": 20}`,
    want,
  )
}
