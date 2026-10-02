package driver_test

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRewriteIgnoresClosingParenInsideBlockComment Verifies block
// comments inside arguments are skipped by call matching.
//
// This covers the branch where the rewrite scanner enters a block comment and
// must not treat comment text as JavaScript syntax.
//
// 1. Compile a plugin call with a closing parenthesis inside a block comment.
// 2. Register a consuming rewrite for the plugin call.
// 3. Assert the emitted JavaScript contains the replacement, not the call.
//
// @evidence contracts/testing.md#behavioral-verification EmitAll consumes the whole call despite a comment-contained closing parenthesis.
// @evidence contracts/testing.md#independent-expectations The whole literal exports.out assignment rules out leftover arguments after replacement.
// @evidence contracts/testing.md#distinguishing-cases Comment delimiter text contrasts with the actual call delimiter.
// @evidence contracts/testing.md#execution-ownership Go unit TestDriverRewriteIgnoresClosingParenInsideBlockComment is discovered by go test in test/driver and invokes source/shim operations directly. Temporary filesystem inputs do not install a consumer or build a host artifact.
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
