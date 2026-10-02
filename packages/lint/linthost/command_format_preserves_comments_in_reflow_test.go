package linthost

import "testing"

// TestCommandFormatPreservesCommentsInReflow guards against print-width
// silently deleting comments when it reflows a list. Prettier preserves every
// comment (and reflows around it); the minimum bar for ttsc is to never DELETE
// one, so when a reflow target carries an interior comment the rule must
// abstain, leaving the source (comment intact) byte-identical. Each source below
// carries a comment in a different position; the first three are flat lines that
// overflow printWidth 60, and the last two are already-broken lists.
//
//  1. Seed five sources, each carrying a comment inside a list, and one
//     comment-free copy of the first call.
//  2. Run `ttsc format` with printWidth 60 on each.
//  3. Require the five commented files byte-identical, so no comment is deleted
//     or moved, and the comment-free call reflowed.
//
// @evidence contracts/testing.md#behavioral-verification Six subcases run the in-process `format` command at printWidth 60: five on lists carrying comments (inline block comment in call arguments, block comment in an array, trailing block comment in an object, trailing line comment on an array element, trailing block comment on a single-property object) requiring each byte-identical so no comment is deleted or moved, and one comment-free twin of the first call that must reflow.
// @evidence contracts/testing.md#independent-expectations Each commented source is an authored literal that is its own expected output, following from the contract that print-width must abstain rather than delete a comment; the twin's expected text is an authored literal in Prettier's one-argument-per-line layout. Nothing is derived from formatter output.
// @evidence contracts/testing.md#distinguishing-cases Each subcase varies the comment position and comment kind in a different list shape; three overflow flat lines that would otherwise be reflowed. The comment cases are fixed points, so only preservation, not a comment-aware reflow, is asserted; the comment-free twin shows the call otherwise reflows.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: each subcase calls run with the format subcommand on a temp-dir project via assertFormatUnchangedWithFormat; no child process, built binary or installed consumer.
func TestCommandFormatPreservesCommentsInReflow(t *testing.T) {
  pw := map[string]any{"printWidth": 60}
  t.Run("call_arg_inline_block_comment", func(t *testing.T) {
    assertFormatUnchangedWithFormat(t, `const a = veryLongFunctionCallNameHere(firstArgumentValue, /* inline */ secondArgumentValueLong);
`, pw)
  })
  // The comment-free twin of the first source: the same call is reflowed, so
  // the abstentions around it come from the comment and not from the shape.
  t.Run("same_call_without_comment_reflows", func(t *testing.T) {
    assertFormatResultWithFormat(t, `const a = veryLongFunctionCallNameHere(firstArgumentValue, secondArgumentValueLong);
`, `const a = veryLongFunctionCallNameHere(
  firstArgumentValue,
  secondArgumentValueLong,
);
`, pw)
  })
  t.Run("array_inline_block_comment", func(t *testing.T) {
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
