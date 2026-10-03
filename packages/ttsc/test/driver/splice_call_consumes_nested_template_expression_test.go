package driver_test

import "testing"

// TestDriverSpliceCallConsumesNestedTemplateExpression Verifies a template
// literal nested inside a template expression does not end call scanning.
//
// The scanner balances the call's parentheses over printed JavaScript. A
// template expression can hold its own template literal, strings and braces, and
// a backtick or parenthesis inside it belongs to that expression rather than to
// the surrounding call.
//
// 1. Splice a plugin call whose argument nests a template in a template.
// 2. Splice a call whose template expression holds a string with a `)`.
// 3. Assert each whole call is replaced and the trailing text is kept.
//
// @evidence contracts/testing.md#behavioral-verification spliceForTest returns exactly the replacement plus the untouched trailing statement when the consumed call holds a nested template or a parenthesis inside a template expression string.
// @evidence contracts/testing.md#independent-expectations The whole-call rewrite contract yields the literal statement; the nested backtick and the quoted parenthesis cannot close the argument list.
// @evidence contracts/testing.md#distinguishing-cases A nested template and a quoted parenthesis inside a template expression are separate cases of the same expression-scanning rule.
// @evidence contracts/testing.md#execution-ownership Go test/driver calls the existing private scanner linkname through spliceForTest in process, without compile or runtime execution.
func TestDriverSpliceCallConsumesNestedTemplateExpression(t *testing.T) {
  for name, tc := range map[string]struct{ text, want string }{
    "nested template": {
      text: "const out = plugin.make(`a${`b${1}`}c`); next();",
      want: "const out = replacement; next();",
    },
    "quoted parenthesis": {
      text: "const out = plugin.make(`a${\")\"}c`); next();",
      want: "const out = replacement; next();",
    },
    "object literal brace": {
      text: "const out = plugin.make(`a${ {b: `)`}.b }c`); next();",
      want: "const out = replacement; next();",
    },
  } {
    t.Run(name, func(t *testing.T) {
      if got := spliceForTest(t, tc.text); got != tc.want {
        t.Fatalf("unexpected rewrite:\nwant: %s\n got: %s", tc.want, got)
      }
    })
  }
}
