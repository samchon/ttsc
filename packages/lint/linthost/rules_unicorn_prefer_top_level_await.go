// unicorn/prefer-top-level-await: ES modules support top-level `await`,
// which produces a flat synchronous-looking sequence and surfaces
// rejections through the host. A `.then(cb)` continuation at the module
// scope re-introduces the callback shape the host could have flattened
// for free, and silently swallows rejections unless the author wires up
// an explicit `.catch`.
//
// AST-only minimum-viable port: visit `CallExpression` and fire when the
// callee is `PropertyAccess(_, then)` AND the call sits at the top
// level of the source file — i.e., walking parents from the call's
// enclosing statement, the first statement-ancestor's parent is a
// `SourceFile`. Calls inside a function, class, namespace body, or
// inside any nested block are excluded; top-level `await` only applies
// to the module body.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-top-level-await.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferTopLevelAwait struct{}

func (unicornPreferTopLevelAwait) Name() string { return "unicorn/prefer-top-level-await" }
func (unicornPreferTopLevelAwait) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornPreferTopLevelAwait) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil ||
    call.Expression.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  access := call.Expression.AsPropertyAccessExpression()
  if access == nil || identifierText(access.Name()) != "then" {
    return
  }
  if !unicornPreferTopLevelAwaitIsTopLevel(node) {
    return
  }
  ctx.Report(node, "Prefer top-level `await` over `.then` chains in ES modules.")
}

// unicornPreferTopLevelAwaitIsTopLevel walks ancestors and reports
// whether `node` is positioned in the top-level statement list of a
// `SourceFile`. The walk crosses parenthesized expressions and
// expression statements; it stops the moment it sees any function-like,
// class-body, block, or module-block boundary, which would push the call
// out of module scope.
func unicornPreferTopLevelAwaitIsTopLevel(node *shimast.Node) bool {
  for cur := node.Parent; cur != nil; cur = cur.Parent {
    switch cur.Kind {
    case shimast.KindSourceFile:
      return true
    case shimast.KindFunctionDeclaration,
      shimast.KindFunctionExpression,
      shimast.KindArrowFunction,
      shimast.KindMethodDeclaration,
      shimast.KindGetAccessor,
      shimast.KindSetAccessor,
      shimast.KindConstructor,
      shimast.KindClassDeclaration,
      shimast.KindClassExpression,
      shimast.KindModuleBlock,
      shimast.KindBlock:
      return false
    }
  }
  return false
}

func init() {
  Register(unicornPreferTopLevelAwait{})
}
