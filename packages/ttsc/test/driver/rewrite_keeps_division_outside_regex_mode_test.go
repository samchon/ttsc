package driver_test

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRewriteKeepsDivisionOutsideRegexMode Verifies that EmitAll replaces a call whose first argument uses division.
//
// Division precedes a second argument; the adjacent regex entry owns literal scanning.
//
// 1. Compile a plugin call whose first argument uses numeric division.
// 2. Register a consuming rewrite for the plugin call.
// 3. Assert the division expression does not prevent the call replacement.
//
// @evidence contracts/testing.md#behavioral-verification EmitAll replaces a call whose first argument uses division.
// @evidence contracts/testing.md#independent-expectations The literal full replacement statement detects treating division as a regex opener.
// @evidence contracts/testing.md#distinguishing-cases Division precedes a second argument; the adjacent regex entry owns literal scanning.
// @evidence contracts/testing.md#execution-ownership emitIndexWithRewrite loads, rewrites, records, and closes an in-process Go Program. Go discovers TestDriverRewriteKeepsDivisionOutsideRegexMode under ./test/driver.
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
  if !strings.Contains(js, `exports.out = "replacement";`) {
    t.Fatalf("division rewrite mismatch:\n%s", js)
  }
}
