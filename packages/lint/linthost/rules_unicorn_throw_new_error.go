// unicorn/throw-new-error: `throw Foo(...)` and `throw new Foo(...)` both
// produce an Error instance because the built-in Error constructors are
// callable without `new`, but the call-form is a footgun — readers expect
// `throw` to be paired with `new`, and some tooling (notably custom Error
// subclasses) stops working when the call-form is mixed in. The rule
// requires `throw new` whenever the operand is a direct call to one of the
// eight built-in Error constructor names.
//
// AST-only: visit each `ThrowStatement`, peel parentheses off its operand,
// and fire when the operand is a `CallExpression` (NOT a `NewExpression`)
// whose callee is an `Identifier` matching the built-in allowlist. Shadowed
// bindings and type-aware widening are intentionally out of scope — the
// rule is a syntactic nudge, not a full Error-tracking pass.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/throw-new-error.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

var unicornThrowNewErrorBuiltinNames = map[string]struct{}{
  "Error":          {},
  "TypeError":      {},
  "RangeError":     {},
  "SyntaxError":    {},
  "ReferenceError": {},
  "EvalError":      {},
  "URIError":       {},
  "AggregateError": {},
}

type unicornThrowNewError struct{}

func (unicornThrowNewError) Name() string { return "unicorn/throw-new-error" }
func (unicornThrowNewError) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindThrowStatement}
}
func (unicornThrowNewError) Check(ctx *Context, node *shimast.Node) {
  throw := node.AsThrowStatement()
  if throw == nil {
    return
  }
  expr := stripParens(throw.Expression)
  if expr == nil || expr.Kind != shimast.KindCallExpression {
    return
  }
  call := expr.AsCallExpression()
  if call == nil {
    return
  }
  name := identifierText(call.Expression)
  if name == "" {
    return
  }
  if _, ok := unicornThrowNewErrorBuiltinNames[name]; !ok {
    return
  }
  ctx.Report(expr, "Use `new` when throwing an error.")
}

func init() {
  Register(unicornThrowNewError{})
}
