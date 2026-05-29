// unicorn/new-for-builtins: built-in globals split into two groups for
// constructor etiquette. Primitive wrappers (`String`, `Number`, …) must
// be called WITHOUT `new` because the wrapper-object form is a footgun
// — `new String("x") instanceof Object` is true but `"x" instanceof
// Object` is false, and the wrapper form does not unify with the
// primitive in equality comparisons. Container constructors (`Array`,
// `Error`, `Map`, …) must be called WITH `new` because the call form
// either misbehaves (`Array(3)` allocates a sparse 3-slot array) or is
// outright invalid (`Error()` still works but is style-inconsistent).
//
// AST-only: visit both `NewExpression` and `CallExpression`. The
// callee-identifier text is matched against the corresponding allowlist
// and reported with the inverted construction message.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/new-for-builtins.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

// Primitive wrappers — `new` is wrong, call form is required.
var unicornNewForBuiltinsPrimitiveWrappers = map[string]struct{}{
  "String":  {},
  "Number":  {},
  "Boolean": {},
  "Symbol":  {},
  "BigInt":  {},
}

// Container constructors — `new` is required, call form is wrong. Note
// that `Symbol` is intentionally NOT in this list: `Symbol(...)` is the
// correct primitive-wrapper call and must not be flagged.
var unicornNewForBuiltinsContainers = map[string]struct{}{
  "Array":          {},
  "Error":          {},
  "EvalError":      {},
  "RangeError":     {},
  "ReferenceError": {},
  "SyntaxError":    {},
  "TypeError":      {},
  "URIError":       {},
  "AggregateError": {},
  "Object":         {},
  "Map":            {},
  "Set":            {},
  "WeakMap":        {},
  "WeakSet":        {},
  "Date":           {},
  "RegExp":         {},
}

type unicornNewForBuiltins struct{}

func (unicornNewForBuiltins) Name() string { return "unicorn/new-for-builtins" }
func (unicornNewForBuiltins) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindNewExpression, shimast.KindCallExpression}
}
func (unicornNewForBuiltins) Check(ctx *Context, node *shimast.Node) {
  switch node.Kind {
  case shimast.KindNewExpression:
    ne := node.AsNewExpression()
    if ne == nil {
      return
    }
    name := identifierText(ne.Expression)
    if name == "" {
      return
    }
    if _, ok := unicornNewForBuiltinsPrimitiveWrappers[name]; ok {
      ctx.Report(node, "Don't use `new "+name+"(...)` with a primitive wrapper like `"+name+"`.")
    }
  case shimast.KindCallExpression:
    call := node.AsCallExpression()
    if call == nil {
      return
    }
    name := identifierText(call.Expression)
    if name == "" {
      return
    }
    if _, ok := unicornNewForBuiltinsContainers[name]; ok {
      ctx.Report(node, "Use `new "+name+"(...)` instead of `"+name+"(...)`.")
    }
  }
}

func init() {
  Register(unicornNewForBuiltins{})
}
