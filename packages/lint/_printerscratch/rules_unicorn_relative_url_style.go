// unicorn/relative-url-style reports a leading ./ only when its removal
// retains a path reference. Scheme-like and network-path prefixes remain.
// Empty, fragment and query references require a literal directory base,
// because a file base changes the pathname when ./ is removed. The name-based
// AST matcher does not resolve shadowed URL constructors. No fix is emitted.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/relative-url-style.md
package linthost

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type unicornRelativeURLStyle struct{}

func (unicornRelativeURLStyle) Name() string { return "unicorn/relative-url-style" }
func (unicornRelativeURLStyle) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindNewExpression}
}
func (unicornRelativeURLStyle) Check(ctx *Context, node *shimast.Node) {
  expr := node.AsNewExpression()
  if expr == nil || identifierText(expr.Expression) != "URL" {
    return
  }
  if expr.Arguments == nil || len(expr.Arguments.Nodes) == 0 {
    return
  }
  arg := expr.Arguments.Nodes[0]
  text := stringLiteralText(arg)
  if text == "" {
    return
  }
  if strings.HasPrefix(text, "./") && unicornRelativeURLPrefixIsRedundant(text[2:], expr.Arguments.Nodes) {
    ctx.Report(arg, "Drop the leading `./` from relative URLs passed to `new URL`.")
  }
}

// Removing ./ must leave a path reference, rather than create a scheme,
// network-path reference or a base-dependent empty/query/fragment reference.
func unicornRelativeURLPrefixIsRedundant(rest string, args []*shimast.Node) bool {
  if strings.HasPrefix(rest, "/") || strings.HasPrefix(rest, "\\") { return false }
  first := strings.SplitN(rest, "/", 2)[0]
  if strings.Contains(first, ":") { return false }
  if rest == "" || strings.HasPrefix(rest, "?") || strings.HasPrefix(rest, "#") {
    if len(args) < 2 { return false }
    base := stringLiteralText(stripParens(args[1]))
    // A literal directory base is the only source-level proof this form
    // retains the same pathname; a dynamic or file base supplies none.
    return strings.HasSuffix(base, "/") && strings.Contains(base, "://") && !strings.ContainsAny(base, "?#")
  }
  return true
}

func init() {
  Register(unicornRelativeURLStyle{})
}
