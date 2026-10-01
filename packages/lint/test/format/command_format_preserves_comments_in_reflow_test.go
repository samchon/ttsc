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
// @evidence contracts/testing.md#behavioral-verification Five subcases run the in-process `format` command at printWidth 60 on lists carrying comments (inline block comment in call arguments, block comment in an array, trailing block comment in an object, trailing line comment on an array element, trailing block comment on a single-property object) and require each file byte-identical so no comment is deleted or moved.
// @evidence contracts/testing.md#independent-expectations Each source is an authored literal that is its own expected output, following from the contract that print-width must abstain rather than delete a comment; it is not derived from formatter output.
// @evidence contracts/testing.md#distinguishing-cases Each subcase varies the comment position and comment kind in a different list shape; three overflow flat lines that would otherwise be reflowed. They are fixed points, so only preservation, not a comment-aware reflow, is asserted.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: each subcase calls run with the format subcommand on a temp-dir project via assertFormatUnchangedWithFormat; no child process, built binary or installed consumer.
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
