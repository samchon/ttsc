// unicorn/prefer-string-raw: a string literal whose source contains
// `\\` (an escaped backslash) is using the escape syntax to represent a
// literal backslash. The same value, written through `String.raw` as
// a template literal, drops every backslash escape and reads as the
// literal text the author meant — particularly noticeable for Windows
// paths, regex source strings, and TeX-shaped snippets.
//
// AST-only: visit `KindStringLiteral` and
// `KindNoSubstitutionTemplateLiteral`. The match keys on the raw source
// bytes of the literal node — `nodeText` returns the as-written source
// — and fires when those bytes contain the two-character sequence `\\`,
// i.e. an escaped backslash that `String.raw` would render literally.
// Untagged template literals with substitutions are out of scope; this
// rule only addresses the "single literal of fixed text" case.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-string-raw.md
package linthost

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type unicornPreferStringRaw struct{}

func (unicornPreferStringRaw) Name() string { return "unicorn/prefer-string-raw" }
func (unicornPreferStringRaw) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindStringLiteral, shimast.KindNoSubstitutionTemplateLiteral}
}
func (unicornPreferStringRaw) Check(ctx *Context, node *shimast.Node) {
  raw := nodeText(ctx.File, node)
  if raw == "" {
    return
  }
  if !strings.Contains(raw, `\\`) {
    return
  }
  ctx.Report(node, "Prefer `String.raw` for strings with backslash escapes.")
}

func init() {
  Register(unicornPreferStringRaw{})
}
