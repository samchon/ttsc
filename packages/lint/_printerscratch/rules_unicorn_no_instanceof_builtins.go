// unicorn/no-instanceof-builtins: `x instanceof Array` (and the other
// built-in container constructors) is broken across realms and for
// user-defined subclasses. The cross-realm hazard is well known —
// `Array` in an iframe is a different constructor than the host
// `Array`, so a cross-realm value fails the check despite being an
// array; the subclass hazard is subtler — `instanceof` walks the
// prototype chain, so a `MyError extends Error` still passes
// `x instanceof Error` and obscures the actual type.
//
// AST-only: visit each `BinaryExpression` whose operator token is
// `instanceof`. The right-hand operand must be a bare identifier whose
// text appears in the built-in allowlist. Property-access or computed
// right-hand operands are out of scope because they cannot be matched
// syntactically against the global names.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-instanceof-builtins.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

var unicornNoInstanceofBuiltinsNames = map[string]struct{}{
  "Array":          {},
  "Error":          {},
  "EvalError":      {},
  "RangeError":     {},
  "ReferenceError": {},
  "SyntaxError":    {},
  "TypeError":      {},
  "URIError":       {},
  "AggregateError": {},
  "Map":            {},
  "Set":            {},
  "WeakMap":        {},
  "WeakSet":        {},
  "Date":           {},
  "RegExp":         {},
  "Promise":        {},
  "Function":       {},
}

type unicornNoInstanceofBuiltins struct{}

func (unicornNoInstanceofBuiltins) Name() string { return "unicorn/no-instanceof-builtins" }
func (unicornNoInstanceofBuiltins) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindBinaryExpression}
}
func (unicornNoInstanceofBuiltins) Check(ctx *Context, node *shimast.Node) {
  bin := node.AsBinaryExpression()
  if bin == nil || bin.OperatorToken == nil || bin.Right == nil {
    return
  }
  if bin.OperatorToken.Kind != shimast.KindInstanceOfKeyword {
    return
  }
  name := identifierText(bin.Right)
  if name == "" {
    return
  }
  if _, ok := unicornNoInstanceofBuiltinsNames[name]; !ok {
    return
  }
  ctx.Report(node, "Don't use `instanceof <Builtin>` — it breaks across realms and for subclasses. Use a type predicate or duck-typing instead.")
}

func init() {
  Register(unicornNoInstanceofBuiltins{})
}
