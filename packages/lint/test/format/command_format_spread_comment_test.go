package linthost

import "testing"

// TestCommandFormatSpreadElementComments probes the vscode buffer.ts shapes:
// comments around spread / awaited elements in a broken array or call argument.
// Prettier preserves them; format must not delete them on reflow.
//
//  1. Exercise the authored command format spread comment fixtures through the Go format dispatcher.
//  2. Require the exact authored output or rejection result for each fixture.
// @evidence contracts/testing.md#behavioral-verification The in-process format command exercises spread comment and compares the complete resulting fixture text with the authored answer, so convergence alone cannot certify a wrong rewrite.
// @evidence contracts/testing.md#independent-expectations The literal source or expected output is the independent answer key described above; the command result is never used to manufacture its expected bytes. Preservation assertions own only their canonical inputs and do not establish correctness for arbitrary malformed layout.
// @evidence contracts/testing.md#distinguishing-cases Named subcases retain these distinct inputs and failure identities: leading_comments_on_spread_and_await, inline_block_comment_before_spread. Each keeps its own assertions under this one discoverable entry.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatSpreadElementComments owns the named subcases below through the Go format dispatcher and disposable JSON-configured source fixtures, without a child product host or installed consumer.
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
