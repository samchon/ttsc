// unicorn/prefer-optional-catch-binding: ES2019 introduced optional
// catch bindings (`catch { ... }`) so that catch clauses that never
// reference the thrown error don't need to declare a binding at all.
// Holding onto the binding name keeps a dead local variable in source
// and signals that the catch body still cares about the error when in
// fact it doesn't.
//
// Report any identifier catch binding whose declared variable is never
// referenced, matching upstream's `getDeclaredVariables(node).some(v =>
// v.references.length > 0)` check. Binding identity comes from the
// TypeScript checker: the block is walked for identifiers that resolve to
// the binding's symbol, so a comment or string literal that merely spells
// the name is not a use, a reference from a nested closure still is, and a
// nested shadow that rebinds the name leaves the catch binding unused.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-optional-catch-binding.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferOptionalCatchBinding struct{}

func (unicornPreferOptionalCatchBinding) Name() string {
  return "unicorn/prefer-optional-catch-binding"
}
func (unicornPreferOptionalCatchBinding) NeedsTypeChecker() bool { return true }
func (unicornPreferOptionalCatchBinding) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCatchClause}
}
func (unicornPreferOptionalCatchBinding) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.Checker == nil || node == nil {
    return
  }
  catch := node.AsCatchClause()
  if catch == nil || catch.VariableDeclaration == nil || catch.Block == nil {
    return
  }
  binding := catch.VariableDeclaration.Name()
  if binding == nil || binding.Kind != shimast.KindIdentifier {
    return
  }
  symbol := ctx.Checker.GetSymbolAtLocation(binding)
  if symbol == nil {
    return
  }
  used := false
  walkDescendants(catch.Block, func(child *shimast.Node) {
    if used || child.Kind != shimast.KindIdentifier {
      return
    }
    if valueSymbolAtIdentifier(ctx, child) == symbol {
      used = true
    }
  })
  if used {
    return
  }
  ctx.Report(binding, "Prefer optional catch binding `catch { ... }` when the error is unused.")
}

func init() {
  Register(unicornPreferOptionalCatchBinding{})
}
