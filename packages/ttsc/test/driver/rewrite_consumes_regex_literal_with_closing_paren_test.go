package driver_test

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRewriteConsumesRegexLiteralWithClosingParen verifies regex bodies
// do not terminate call matching early.
//
// This preserves the internal rewrite scanner coverage from the old production
// package test while exercising it through the public emit facade.
//
// 1. Compile a plugin call whose regex literal contains a closing parenthesis.
// 2. Register a consuming rewrite for that emitted call.
// 3. Assert the call is replaced and the original plugin call disappears.
func TestDriverRewriteConsumesRegexLiteralWithClosingParen(t *testing.T) {
  js := emitIndexWithRewrite(t, `declare const plugin: { make(...args: unknown[]): string };
export const out = plugin.make(/\)/, "ok");
`, driver.Rewrite{
    RootName:      "plugin",
    Method:        "make",
    Replacement:   `"replacement"`,
    ConsumeParens: true,
  })
  // The whole statement is asserted: a scanner that closed the call at the
  // regex's `)` would leave `/, "ok")` behind the replacement while still
  // containing "replacement" and no `plugin.make`.
  if !strings.Contains(js, `exports.out = "replacement";`) {
    t.Fatalf("regex literal rewrite mismatch:\n%s", js)
  }
}
