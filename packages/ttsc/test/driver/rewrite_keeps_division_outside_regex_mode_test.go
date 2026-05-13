package driver_test

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRewriteKeepsDivisionOutsideRegexMode verifies division operators do
// not get parsed as regex literals while matching calls.
//
// The scanner uses the previous significant token to distinguish regex starts
// from division, and this public emit fixture keeps that branch covered.
//
// 1. Compile a plugin call whose first argument uses numeric division.
// 2. Register a consuming rewrite for the plugin call.
// 3. Assert the division expression does not prevent the call replacement.
func TestDriverRewriteKeepsDivisionOutsideRegexMode(t *testing.T) {
  js := emitIndexWithRewrite(t, `declare const plugin: { make(...args: unknown[]): string };
declare const total: number;
declare const divisor: number;
export const out = plugin.make(total / divisor, 2);
`, driver.Rewrite{
    RootName:      "plugin",
    Method:        "make",
    Replacement:   `"replacement"`,
    ConsumeParens: true,
  })
  if !strings.Contains(js, `"replacement"`) || strings.Contains(js, "plugin.make") {
    t.Fatalf("division rewrite mismatch:\n%s", js)
  }
}
