package driver_test

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRewriteIgnoresClosingParenInsideLineComment verifies line comments
// inside arguments are skipped by call matching.
//
// This covers the branch where a line comment reaches the end of line before
// the scanner resumes normal parenthesis depth tracking.
//
// 1. Compile a multiline plugin call with a closing parenthesis in a comment.
// 2. Register a consuming rewrite for the plugin call.
// 3. Assert the emitted JavaScript is patched once the real call closes.
func TestDriverRewriteIgnoresClosingParenInsideLineComment(t *testing.T) {
  js := emitIndexWithRewrite(t, "declare const plugin: { make(...args: unknown[]): string };\n"+
    "export const out = plugin.make(\n"+
    "  1, // )\n"+
    "  2\n"+
    ");\n", driver.Rewrite{
    RootName:      "plugin",
    Method:        "make",
    Replacement:   `"replacement"`,
    ConsumeParens: true,
  })
  // The whole statement is asserted: closing the call at the comment's `)`
  // would leave the remaining arguments behind the replacement while still
  // containing "replacement" and no `plugin.make`.
  if !strings.Contains(js, `exports.out = "replacement";`) {
    t.Fatalf("line comment rewrite mismatch:\n%s", js)
  }
}
