// unicorn/no-hex-escape: `\xHH` escapes inside string and template
// literals are legal but they read worse than the equivalent
// `\u00HH` Unicode escape — there's only one way to write a Unicode
// escape, while a hex escape silently widens to a Unicode escape at
// runtime anyway. The rule nudges authors toward the Unicode form.
//
// AST-only: visit `KindStringLiteral` and `KindNoSubstitutionTemplateLiteral`,
// read the raw source text via `nodeText` (the parser already decodes
// escapes into the `.Text` value, so a normal accessor would see `©`
// instead of `\xA9`), and fire when the source contains a `\xHH`
// occurrence where HH is two hex digits.
//
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-hex-escape.md
package linthost

import (
  "regexp"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

var unicornNoHexEscapePattern = regexp.MustCompile(`\\x[0-9A-Fa-f]{2}`)

type unicornNoHexEscape struct{}

func (unicornNoHexEscape) Name() string { return "unicorn/no-hex-escape" }
func (unicornNoHexEscape) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindStringLiteral, shimast.KindNoSubstitutionTemplateLiteral}
}
func (unicornNoHexEscape) Check(ctx *Context, node *shimast.Node) {
  source := nodeText(ctx.File, node)
  if source == "" {
    return
  }
  if unicornNoHexEscapePattern.MatchString(source) {
    ctx.Report(node, "Prefer Unicode escapes (`\\uXXXX`) over hex escapes (`\\xHH`).")
  }
}

func init() {
  Register(unicornNoHexEscape{})
}
