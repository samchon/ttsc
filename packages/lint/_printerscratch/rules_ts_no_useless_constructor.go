// typescript/no-useless-constructor: TS-aware extension of the core
// `no-useless-constructor` rule. A class constructor with an empty body
// and no parameter properties is noise — the engine generates the same
// default constructor anyway.
//
// The TS variant differs from the core rule in one detail: a
// parameter-property declaration (`constructor(public foo: number) {}`)
// carries a semantic side effect — it implicitly declares the class
// field and assigns the argument to it. Removing the constructor would
// remove the field. So an otherwise-empty body is NOT useless when at
// least one parameter is a parameter property.
// typescript-eslint strict:
// https://typescript-eslint.io/rules/no-useless-constructor/
//
// AST-only. The trigger is a `KindConstructor` whose body is an empty
// block and whose parameter list contains no `public` / `private` /
// `protected` / `readonly` / `override` parameter property.
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type tsNoUselessConstructor struct{}

func (tsNoUselessConstructor) Name() string { return "typescript/no-useless-constructor" }
func (tsNoUselessConstructor) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindConstructor}
}
func (tsNoUselessConstructor) Check(ctx *Context, node *shimast.Node) {
  ctor := node.AsConstructorDeclaration()
  if ctor == nil || ctor.Body == nil {
    return
  }
  body := ctor.Body.AsBlock()
  if body == nil || body.Statements == nil || len(body.Statements.Nodes) != 0 {
    return
  }
  // Any parameter property keeps the constructor meaningful: the
  // shorthand IS the field declaration. Removing the constructor
  // would silently delete the field, so this is not "useless".
  for _, param := range node.Parameters() {
    if isParameterProperty(param) {
      return
    }
  }
  ctx.Report(node, "Useless constructor with no parameter properties.")
}

func init() {
  Register(tsNoUselessConstructor{})
}
