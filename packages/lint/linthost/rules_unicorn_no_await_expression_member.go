// unicorn/no-await-expression-member: `(await foo).bar` and
// `(await foo)[index]` mix two reading positions in one expression —
// the resolution step (`await foo`) and the projection step (`.bar`).
// Splitting them into a temporary `const value = await foo; value.bar`
// makes the order of operations explicit and lines up better with
// stepping through the async function in a debugger.
//
// AST-only: any `PropertyAccessExpression` whose receiver is an
// `AwaitExpression` (possibly wrapped in `ParenthesizedExpression`) fires.
// `ElementAccessExpression` is left out of this minimal pass — the
// PropertyAccess shape is the canonical violation cited in the upstream
// docs and matches the receiver shape directly via `stripParens`.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-await-expression-member.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoAwaitExpressionMember struct{}

func (unicornNoAwaitExpressionMember) Name() string {
	return "unicorn/no-await-expression-member"
}
func (unicornNoAwaitExpressionMember) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindPropertyAccessExpression}
}
func (unicornNoAwaitExpressionMember) Check(ctx *Context, node *shimast.Node) {
	access := node.AsPropertyAccessExpression()
	if access == nil {
		return
	}
	receiver := stripParens(access.Expression)
	if receiver == nil || receiver.Kind != shimast.KindAwaitExpression {
		return
	}
	ctx.Report(node, "Don't use member access on an `await` expression — assign the awaited value to a variable first.")
}

func init() {
	Register(unicornNoAwaitExpressionMember{})
}
