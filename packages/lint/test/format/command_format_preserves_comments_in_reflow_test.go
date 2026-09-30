package linthost

import "testing"

// TestCommandFormatPreservesCommentsInReflow guards against print-width
// silently deleting comments when it reflows a list. Prettier preserves every
// comment (and reflows around it); the minimum bar for ttsc is to never DELETE
// one, so when a reflow target carries an interior comment the rule must
// abstain, leaving the flat source (comment intact) byte-identical. Each source
// below overflows printWidth 60 and carries a comment in a different position.
//
//  1. Exercise the authored command format preserves comments in reflow fixtures through the Go format dispatcher.
//  2. Require the exact authored output or rejection result for each fixture.
// @evidence contracts/testing.md#behavioral-verification The in-process format command exercises preserves comments in reflow and compares the complete resulting fixture text with the authored answer, so convergence alone cannot certify a wrong rewrite.
// @evidence contracts/testing.md#independent-expectations The literal source or expected output is the independent answer key described above; the command result is never used to manufacture its expected bytes. Preservation assertions own only their canonical inputs and do not establish correctness for arbitrary malformed layout.
// @evidence contracts/testing.md#distinguishing-cases Named subcases retain these distinct inputs and failure identities: call_arg_inline_block_comment, array_standalone_line_comment, object_trailing_block_comment, array_element_trailing_line_comment, object_single_prop_trailing_comment. Each keeps its own assertions under this one discoverable entry.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatPreservesCommentsInReflow owns the named subcases below through the Go format dispatcher and disposable JSON-configured source fixtures, without a child product host or installed consumer.
func TestCommandFormatPreservesCommentsInReflow(t *testing.T) {
  pw := map[string]any{"printWidth": 60}
  t.Run("call_arg_inline_block_comment", func(t *testing.T) {
    assertFormatUnchangedWithFormat(t, `const a = veryLongFunctionCallNameHere(firstArgumentValue, /* inline */ secondArgumentValueLong);
`, pw)
  })
  t.Run("array_standalone_line_comment", func(t *testing.T) {
    assertFormatUnchangedWithFormat(t, `const b = [firstElementValueHere, /* mid */ secondElementValueHereToo, thirdEl];
`, pw)
  })
  t.Run("object_trailing_block_comment", func(t *testing.T) {
    assertFormatUnchangedWithFormat(t, `const c = { preserveSymlinks: false /* trailing */, otherOptionValueHereToBreak: true };
`, pw)
  })
  // a line comment trailing an array element (the vscode korean.ts shape):
  // the element list already spans lines because the comment forces it, so
  // reflow must not drop the `// ...`.
  t.Run("array_element_trailing_line_comment", func(t *testing.T) {
    assertFormatUnchangedWithFormat(t, `const arr = [
  firstElementValueHere, // trailing one
  secondElementValueHere,
  thirdElementValueHere,
];
`, pw)
  })
  // a single-property object whose value carries a trailing block comment and
  // overflows: reflow must keep the comment.
  t.Run("object_single_prop_trailing_comment", func(t *testing.T) {
    assertFormatUnchangedWithFormat(t, `const d = {
  preserveSymlinksForThisLongOptionName: false /* copying to another device */,
};
`, pw)
  })
}
