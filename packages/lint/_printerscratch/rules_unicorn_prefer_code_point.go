// unicorn/prefer-code-point: `String#charCodeAt` and
// `String.fromCharCode` operate on UTF-16 code units, so they split
// astral characters (anything above U+FFFF) into surrogate pairs and
// return numbers that no longer correspond to the Unicode code point
// the source string visually shows. `String#codePointAt` and
// `String.fromCodePoint` operate on full code points and round-trip
// astral characters correctly.
//
// AST-only: visit `CallExpression`, match property-access callees whose
// method identifier is `charCodeAt` or `fromCharCode`. For
// `fromCharCode` also require the receiver to be the literal identifier
// `String` so we only flag the static `String.fromCharCode` form; for
// `charCodeAt` the receiver may be anything (any string instance).
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-code-point.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferCodePoint struct{}

func (unicornPreferCodePoint) Name() string { return "unicorn/prefer-code-point" }
func (unicornPreferCodePoint) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornPreferCodePoint) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil || call.Expression.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  access := call.Expression.AsPropertyAccessExpression()
  if access == nil {
    return
  }
  switch identifierText(access.Name()) {
  case "charCodeAt":
    // Instance call — receiver type is irrelevant.
    ctx.Report(node, "Prefer `String#codePointAt()` / `String.fromCodePoint()` over `charCodeAt` / `fromCharCode`.")
  case "fromCharCode":
    // Static call — only the `String.fromCharCode(...)` shape.
    if identifierText(access.Expression) != "String" {
      return
    }
    ctx.Report(node, "Prefer `String#codePointAt()` / `String.fromCodePoint()` over `charCodeAt` / `fromCharCode`.")
  }
}

func init() {
  Register(unicornPreferCodePoint{})
}
