package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

// noExtendNative forbids extending a native builtin's prototype, which mutates a
// shared global and leaks across the entire realm. Mirroring ESLint's
// no-extend-native, it flags every shape that adds to `<Builtin>.prototype`:
// direct member assignment (`X.prototype.y = …` and `X.prototype["y"] = …`) and
// `Object.defineProperty` / `Object.defineProperties` calls whose target is a
// native prototype. The `exceptions` option removes builtins from the set.
// https://eslint.org/docs/latest/rules/no-extend-native
type noExtendNative struct{ optionsRule }

type noExtendNativeOptions struct {
  Exceptions []string `json:"exceptions"`
}

func (noExtendNative) Name() string { return "no-extend-native" }
func (noExtendNative) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindBinaryExpression, shimast.KindCallExpression}
}
func (noExtendNative) Check(ctx *Context, node *shimast.Node) {
  switch node.Kind {
  case shimast.KindBinaryExpression:
    checkExtendNativeAssignment(ctx, node)
  case shimast.KindCallExpression:
    checkExtendNativeDefineProperty(ctx, node)
  }
}

// checkExtendNativeAssignment reports `<Builtin>.prototype.<key> = …` and
// `<Builtin>.prototype["<key>"] = …`. Mirroring upstream's isAssigningToPropertyOf,
// the assigned member key itself is not inspected: any write to a member of the
// prototype extends it.
func checkExtendNativeAssignment(ctx *Context, node *shimast.Node) {
  expr := node.AsBinaryExpression()
  if expr == nil || expr.OperatorToken == nil || expr.OperatorToken.Kind != shimast.KindEqualsToken {
    return
  }
  target := stripParens(expr.Left)
  if target == nil {
    return
  }
  var object *shimast.Node
  switch target.Kind {
  case shimast.KindPropertyAccessExpression:
    if access := target.AsPropertyAccessExpression(); access != nil {
      object = access.Expression
    }
  case shimast.KindElementAccessExpression:
    if access := target.AsElementAccessExpression(); access != nil {
      object = access.Expression
    }
  default:
    return
  }
  if builtin := extendNativePrototypeBuiltin(ctx, object); builtin != "" {
    ctx.Report(node, builtin+" prototype is read only, properties should not be added.")
  }
}

// checkExtendNativeDefineProperty reports
// `Object.defineProperty(<Builtin>.prototype, …)` and the `defineProperties`
// variant, mirroring upstream's isInDefinePropertyCall: the extended prototype
// is the call's first argument.
func checkExtendNativeDefineProperty(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || call.Arguments == nil || len(call.Arguments.Nodes) == 0 {
    return
  }
  callee := stripParens(call.Expression)
  if !isMatchingPropertyAccess(callee, "Object", "defineProperty") &&
    !isMatchingPropertyAccess(callee, "Object", "defineProperties") {
    return
  }
  if builtin := extendNativePrototypeBuiltin(ctx, call.Arguments.Nodes[0]); builtin != "" {
    ctx.Report(node, builtin+" prototype is read only, properties should not be added.")
  }
}

// extendNativePrototypeBuiltin returns the native builtin name when `node` reads
// `<Builtin>.prototype` — through `.prototype` property access or a static
// `["prototype"]` element access — and the builtin is protected (a known native
// not listed in the rule's `exceptions` option). Otherwise it returns "".
// Mirrors upstream's isPrototypePropertyAccessed, which resolves the accessed
// key with getStaticPropertyName, combined with the exceptions filter.
func extendNativePrototypeBuiltin(ctx *Context, node *shimast.Node) string {
  node = stripParens(node)
  if node == nil {
    return ""
  }
  var object *shimast.Node
  var key string
  switch node.Kind {
  case shimast.KindPropertyAccessExpression:
    access := node.AsPropertyAccessExpression()
    if access == nil {
      return ""
    }
    object = access.Expression
    key = identifierText(access.Name())
  case shimast.KindElementAccessExpression:
    access := node.AsElementAccessExpression()
    if access == nil {
      return ""
    }
    object = access.Expression
    key = stringLiteralText(access.ArgumentExpression)
  default:
    return ""
  }
  if key != "prototype" {
    return ""
  }
  builtin := identifierText(stripParens(object))
  if !isExtendNativeBuiltin(builtin) || extendNativeExcepted(ctx, builtin) {
    return ""
  }
  return builtin
}

// extendNativeExcepted reports whether the rule's `exceptions` option opts the
// given builtin out of the protected set.
func extendNativeExcepted(ctx *Context, builtin string) bool {
  var options noExtendNativeOptions
  _ = ctx.DecodeOptions(&options)
  for _, name := range options.Exceptions {
    if name == builtin {
      return true
    }
  }
  return false
}

func isExtendNativeBuiltin(name string) bool {
  switch name {
  case "Object", "Array", "String", "Number", "Boolean", "Function",
    "Date", "RegExp", "Error", "Map", "Set", "WeakMap", "WeakSet",
    "Promise", "Symbol":
    return true
  }
  return false
}

func init() {
  Register(noExtendNative{})
}
