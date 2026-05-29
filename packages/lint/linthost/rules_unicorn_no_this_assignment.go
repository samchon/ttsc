// unicorn/no-this-assignment: capturing `this` into a local variable —
// the classic `const self = this;` / `var that = this;` — was a workaround
// before arrow functions existed. Modern callers should close over the
// outer `this` with an arrow function instead so the binding cannot drift
// or be reassigned.
//
// AST-only: dispatch on `KindVariableDeclaration` and fire when the
// initializer (after stripping parentheses, so `const self = (this);`
// also matches) is `KindThisKeyword`. The diagnostic anchors on the
// declaration node so reporters surface the whole `name = this` line.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-this-assignment.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoThisAssignment struct{}

func (unicornNoThisAssignment) Name() string { return "unicorn/no-this-assignment" }
func (unicornNoThisAssignment) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindVariableDeclaration}
}
func (unicornNoThisAssignment) Check(ctx *Context, node *shimast.Node) {
  decl := node.AsVariableDeclaration()
  if decl == nil || decl.Initializer == nil {
    return
  }
  if stripParens(decl.Initializer).Kind != shimast.KindThisKeyword {
    return
  }
  ctx.Report(node, "Don't assign `this` to a variable — capture via an arrow function instead.")
}

func init() {
  Register(unicornNoThisAssignment{})
}
