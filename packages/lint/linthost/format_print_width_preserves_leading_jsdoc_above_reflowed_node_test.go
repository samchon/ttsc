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
//
// @evidence contracts/testing.md#behavioral-verification The registered format/print-width rule parses the preserves leading jsdoc above reflowed node fixture and applies its edit; complete authored output equality rejects lost source content or punctuation alongside incorrect line layout. The owned result is: Assert the JSDoc survives in the output, sitting above the reflowed declaration.
// @evidence contracts/testing.md#independent-expectations The source operands and literal expected layout are authored independently of the rule printer. The fixture fixes printWidth and indentation, so expected line placement does not come from rendering the implementation under test.
// @evidence contracts/testing.md#distinguishing-cases The authored scenario begins with: Configure printWidth=20. The asserted decision is: Assert the JSDoc survives in the output, sitting above the reflowed declaration. Other fixture shapes remain in their separately named hosts.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthPreservesLeadingJSDocAboveReflowedNode is one Go unit entry through the registered rule engine, parser and fix applier; it uses no installed consumer or child product host.
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
