package linthost

import "testing"

// TestCommandFormatSpreadElementComments probes the vscode buffer.ts shapes:
// comments around spread / awaited elements in a broken array or call argument.
// Prettier preserves them; format must not delete them on reflow.
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
