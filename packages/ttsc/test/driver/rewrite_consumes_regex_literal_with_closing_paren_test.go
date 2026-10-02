package driver_test

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRewriteConsumesRegexLiteralWithClosingParen Verifies that EmitAll consumes a whole plugin call whose regex contains a closing parenthesis.
//
// The regex-parenthesis input owns this scanner branch; division has a separate case.
//
// 1. Compile a plugin call whose regex literal contains a closing parenthesis.
// 2. Register a consuming rewrite for that emitted call.
// 3. Assert the call is replaced and the original plugin call disappears.
//
// @evidence contracts/testing.md#behavioral-verification EmitAll consumes a whole plugin call whose regex contains a closing parenthesis.
// @evidence contracts/testing.md#independent-expectations The literal complete exports.out replacement statement excludes leftover regex and argument text.
// @evidence contracts/testing.md#distinguishing-cases The regex-parenthesis input owns this scanner branch; division has a separate case.
// @evidence contracts/testing.md#execution-ownership emitIndexWithRewrite loads, emits, and closes the Program through the public Go driver. Go discovers TestDriverRewriteConsumesRegexLiteralWithClosingParen under ./test/driver.
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
