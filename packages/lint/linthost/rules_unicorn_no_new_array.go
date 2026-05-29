// unicorn/no-new-array: `new Array(n)` is a sharp edge — with a single
// numeric argument it allocates a sparse array of length `n`, with
// anything else it constructs from the arguments. The two readings
// share one syntax, so the same expression silently switches meaning
// when its input shape changes. The replacement is an array literal,
// `Array.from`, or `Array.of`.
//
// AST-only and identifier-text-driven: any `NewExpression` whose callee
// is an `Identifier` named `Array` fires. Shadowed `Array` bindings,
// argument count, and argument types are not part of the match,
// mirroring `unicorn/no-new-buffer`.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-new-array.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoNewArray struct{}

func (unicornNoNewArray) Name() string           { return "unicorn/no-new-array" }
func (unicornNoNewArray) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindNewExpression} }
func (unicornNoNewArray) Check(ctx *Context, node *shimast.Node) {
  ne := node.AsNewExpression()
  if ne != nil && identifierText(ne.Expression) == "Array" {
    ctx.Report(node, "Don't use `new Array(...)` — use an array literal or `Array.from`/`Array.of` instead.")
  }
}

func init() {
  Register(unicornNoNewArray{})
}
