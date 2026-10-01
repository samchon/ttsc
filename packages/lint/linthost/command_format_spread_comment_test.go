package linthost

import "testing"

// TestCommandFormatSpreadElementComments probes the vscode buffer.ts shapes:
// comments around spread / awaited elements in a broken array or call argument.
// Prettier preserves them; format must not delete them on reflow.
//
//  1. Exercise the authored command format spread comment fixtures through the Go format dispatcher.
//  2. Require the exact authored output or rejection result for each fixture.
// @evidence contracts/testing.md#behavioral-verification Two subcases run the in-process `format` command at printWidth 60 on authored broken arrays and call arguments carrying comments (line comments before a spread and an awaited element, and an inline block comment before a spread) and require each file unchanged.
// @evidence contracts/testing.md#independent-expectations Sources are authored literals that serve as their own expected output, following from the contract that format must not delete or move comments on reflow; nothing is derived from the formatter.
// @evidence contracts/testing.md#distinguishing-cases Distinguishes line comments on separate lines from an inline block comment sharing a line with a spread element; both are fixed points, so only preservation is asserted.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: each subcase calls run with the format subcommand on a temp-dir project via assertFormatUnchangedWithFormat; no child process, built binary or installed consumer.
func TestCommandFormatSpreadElementComments(t *testing.T) {
  pw := map[string]any{"printWidth": 60}
  t.Run("leading_comments_on_spread_and_await", func(t *testing.T) {
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
