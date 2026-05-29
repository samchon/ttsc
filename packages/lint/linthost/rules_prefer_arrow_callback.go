// preferArrowCallback: a `function() { … }` expression passed as a
// callback argument predates ES2015 arrow functions. The arrow form is
// shorter, captures `this` lexically (the usual intent for a callback),
// and avoids the named-binding hoisting of `function` expressions.
// https://eslint.org/docs/latest/rules/prefer-arrow-callback
//
// AST-only: visit every `CallExpression`/`NewExpression` and check
// whether any of its arguments is a `FunctionExpression`. A few shapes
// are skipped because converting them would change behaviour:
//
//   - generators (`function* () {}`) cannot be arrows at all.
//   - bodies that read `this` or `arguments` rely on the function
//     expression's own binding; an arrow would capture the surrounding
//     binding instead.
//   - functions immediately followed by `.bind(…)` opt the caller into
//     an explicit `this` binding that an arrow cannot honour.
//
// Named function expressions (`function name() { … }`) still flag —
// ESLint's default `allowNamedFunctions` is `false` — but a body that
// references the function's own name through the inner binding is left
// alone so the recursion stays valid.
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type preferArrowCallback struct{}

func (preferArrowCallback) Name() string { return "prefer-arrow-callback" }
func (preferArrowCallback) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression, shimast.KindNewExpression}
}
func (preferArrowCallback) Check(ctx *Context, node *shimast.Node) {
  args := callArgumentsList(node)
  if args == nil {
    return
  }
  for _, arg := range args.Nodes {
    fn := stripParens(arg)
    if fn == nil || fn.Kind != shimast.KindFunctionExpression {
      continue
    }
    if !preferArrowCallbackEligible(fn) {
      continue
    }
    ctx.Report(fn, "Unexpected function expression. Use an arrow function instead.")
  }
}

// callArgumentsList returns the argument NodeList of a CallExpression or
// NewExpression, or nil when the node either lacks arguments or is not a
// call/new shape.
func callArgumentsList(node *shimast.Node) *shimast.NodeList {
  switch node.Kind {
  case shimast.KindCallExpression:
    call := node.AsCallExpression()
    if call == nil {
      return nil
    }
    return call.Arguments
  case shimast.KindNewExpression:
    newExpr := node.AsNewExpression()
    if newExpr == nil {
      return nil
    }
    return newExpr.Arguments
  }
  return nil
}

// preferArrowCallbackEligible reports whether `fn` (a FunctionExpression)
// can be converted to an arrow without changing observable behaviour.
// The function must not be a generator, must not read `this` or
// `arguments` outside any nested function-like, and must not reference
// its own inner name (a self-recursion handle that an arrow cannot
// reproduce).
func preferArrowCallbackEligible(fn *shimast.Node) bool {
  expr := fn.AsFunctionExpression()
  if expr == nil {
    return false
  }
  if expr.AsteriskToken != nil {
    return false
  }
  innerName := identifierText(expr.Name())
  body := expr.Body
  if body == nil {
    return true
  }
  usesForbidden := false
  walkFunctionBody(body, func(child *shimast.Node) {
    if usesForbidden || child == nil {
      return
    }
    switch child.Kind {
    case shimast.KindThisKeyword:
      usesForbidden = true
    case shimast.KindIdentifier:
      text := identifierText(child)
      if text == "arguments" {
        // Skip `obj.arguments` — that's an unrelated member access.
        if parent := child.Parent; parent != nil && parent.Kind == shimast.KindPropertyAccessExpression {
          if access := parent.AsPropertyAccessExpression(); access != nil && access.Name() == child {
            return
          }
        }
        usesForbidden = true
        return
      }
      if innerName != "" && text == innerName {
        if parent := child.Parent; parent != nil && parent.Kind == shimast.KindPropertyAccessExpression {
          if access := parent.AsPropertyAccessExpression(); access != nil && access.Name() == child {
            return
          }
        }
        usesForbidden = true
      }
    }
  })
  return !usesForbidden
}

func init() {
  Register(preferArrowCallback{})
}
