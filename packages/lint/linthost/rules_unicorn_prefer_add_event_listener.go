// unicorn/prefer-add-event-listener: assigning a function to an
// `on*` DOM property (`el.onclick = …`) installs at most one handler
// — any prior assignment is silently overwritten. `addEventListener`
// composes: every listener that registers receives the event, and
// `removeEventListener` revokes exactly the listener that was added.
// The property-assignment form is therefore a fragile shape that the
// rule encourages replacing with the explicit listener API.
//
// AST-only: visit each `BinaryExpression`, restrict to `=` assignments
// whose LHS is a property access, and match property names that start
// with `on` followed by at least one lowercase letter (so unrelated
// names like `onnxruntime` or `onClickHandler` don't fire). The
// assignment node itself is reported so the diagnostic underlines the
// statement the reader needs to rewrite.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-add-event-listener.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferAddEventListener struct{}

func (unicornPreferAddEventListener) Name() string { return "unicorn/prefer-add-event-listener" }
func (unicornPreferAddEventListener) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindBinaryExpression}
}
func (unicornPreferAddEventListener) Check(ctx *Context, node *shimast.Node) {
  bin := node.AsBinaryExpression()
  if bin == nil || bin.OperatorToken == nil {
    return
  }
  if bin.OperatorToken.Kind != shimast.KindEqualsToken {
    return
  }
  lhs := stripParens(bin.Left)
  if lhs == nil || lhs.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  access := lhs.AsPropertyAccessExpression()
  if access == nil {
    return
  }
  name := identifierText(access.Name())
  if !isUnicornOnEventName(name) {
    return
  }
  ctx.Report(node, "Prefer `addEventListener` / `removeEventListener` over assigning to `on*` properties.")
}

// isUnicornOnEventName reports whether `name` is `on<lower>...` of at
// least 3 characters. The third-character lowercase gate prevents
// matches on `onClick`, `onnxruntime`, and other names that begin with
// `on` but are not DOM event handlers.
func isUnicornOnEventName(name string) bool {
  if len(name) < 3 {
    return false
  }
  if name[0] != 'o' || name[1] != 'n' {
    return false
  }
  c := name[2]
  return c >= 'a' && c <= 'z'
}

func init() {
  Register(unicornPreferAddEventListener{})
}
