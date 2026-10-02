package linthost

import "testing"

// TestCommandFormatSpreadElementComments verifies the vscode buffer.ts shapes:
// comments around spread and plain elements in a broken array or call argument.
// Prettier preserves them; format must not delete them on reflow.
//
//  1. Seed a broken call-argument array and a broken array, both carrying comments next to spread elements.
//  2. Run `ttsc format` with printWidth 60 on each.
//  3. Require each file byte-identical.
//
// @evidence contracts/testing.md#behavioral-verification Two subcases run the in-process `format` command at printWidth 60 on authored broken arrays and call arguments carrying comments (line comments before a spread and a plain identifier element, and an inline block comment before a spread) and require each file unchanged.
// @evidence contracts/testing.md#independent-expectations Sources are authored literals that serve as their own expected output, following from the contract that format must not delete or move comments on reflow; nothing is derived from the formatter.
// @evidence contracts/testing.md#distinguishing-cases Distinguishes line comments on separate lines from an inline block comment sharing a line with a spread element; both are fixed points, so only preservation is asserted.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: each subcase calls run with the format subcommand on a temp-dir project via assertFormatUnchangedWithFormat; no child process, built binary or installed consumer.
func TestCommandFormatSpreadElementComments(t *testing.T) {
  pw := map[string]any{"printWidth": 60}
  t.Run("leading_comments_on_spread_and_plain_element", func(t *testing.T) {
    assertFormatUnchangedWithFormat(t, `const a = concatBuffersFunction([
  // leading comment here
  ...spreadElementValue,
  // another comment
  awaitedResultValueHere,
]);
`, pw)
  })
  t.Run("inline_block_comment_before_spread", func(t *testing.T) {
    assertFormatUnchangedWithFormat(t, `const b = [
  ...firstSpreadValueHere,
  /* inline */ ...secondSpreadValueHereLong,
];
`, pw)
  })
}
