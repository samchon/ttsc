// unicorn/prefer-module: ES modules are the spec-blessed module
// system and provide cross-runtime semantics that CommonJS does not.
// `require(...)` is dynamic, synchronous, and tied to Node's module
// resolver; `__dirname` and `__filename` only exist inside CJS modules
// and silently turn into `undefined` under ESM. The rule flags the
// CommonJS-only constructs so the codebase converges on ESM-native
// equivalents (`import` / `import.meta.dirname` / `import.meta.filename`).
//
// AST-only: visit `CallExpression` to match bare `require(...)` calls
// and visit `Identifier` to match value-position reads of
// `__dirname` / `__filename`. Identifier matches are gated by the
// shared value-position helper so binding sites, property keys, and
// type references are filtered out.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-module.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferModule struct{}

func (unicornPreferModule) Name() string { return "unicorn/prefer-module" }
func (unicornPreferModule) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression, shimast.KindIdentifier}
}
func (unicornPreferModule) Check(ctx *Context, node *shimast.Node) {
  switch node.Kind {
  case shimast.KindCallExpression:
    call := node.AsCallExpression()
    if call == nil || call.Expression == nil {
      return
    }
    if identifierText(call.Expression) != "require" {
      return
    }
    ctx.Report(node, "Prefer ES modules over CommonJS — use `import` / `import.meta.dirname` / `import.meta.filename`.")
  case shimast.KindIdentifier:
    name := identifierText(node)
    if name != "__dirname" && name != "__filename" {
      return
    }
    if !isUnicornValuePositionIdentifier(node) {
      return
    }
    ctx.Report(node, "Prefer ES modules over CommonJS — use `import` / `import.meta.dirname` / `import.meta.filename`.")
  }
}

func init() {
  Register(unicornPreferModule{})
}
