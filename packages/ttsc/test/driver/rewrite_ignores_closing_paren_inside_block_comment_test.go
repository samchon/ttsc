package driver_test

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRewriteIgnoresClosingParenInsideBlockComment verifies block
// comments inside arguments are skipped by call matching.
//
// This covers the branch where the rewrite scanner enters a block comment and
// must not treat comment text as JavaScript syntax.
//
// 1. Compile a plugin call with a closing parenthesis inside a block comment.
// 2. Register a consuming rewrite for the plugin call.
// 3. Assert the emitted JavaScript contains the replacement, not the call.
func TestDriverRewriteIgnoresClosingParenInsideBlockComment(t *testing.T) {
  js := emitIndexWithRewrite(t, `declare const plugin: { make(...args: unknown[]): string };
export const out = plugin.make(1 /* ) */, 2);
`, driver.Rewrite{
    RootName:      "plugin",
    Method:        "make",
    Replacement:   `"replacement"`,
    ConsumeParens: true,
  })
  // The whole statement is asserted: closing the call at the comment's `)`
  // would leave ` */, 2);` behind the replacement while still containing
  // "replacement" and no `plugin.make`.
  if !strings.Contains(js, `exports.out = "replacement";`) {
    t.Fatalf("block comment rewrite mismatch:\n%s", js)
  }
}
