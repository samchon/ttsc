// unicorn/no-unnecessary-await: `await x` only changes anything when
// `x` is thenable; awaiting a value that the language guarantees is
// not a promise (a literal, an object/array literal, the result of a
// non-async constructor call, etc.) just costs one extra microtask and
// reads as if the author forgot what type they were holding.
//
// AST-only minimum-viable port: visit each `AwaitExpression` and only
// fire when the operand (after `stripParens`) is a node whose value the
// parser already pins as not-thenable: a string/number/bigint/regex
// literal, a template literal, an array or object literal, `true`,
// `false`, or `null`. Without type information, identifiers and
// function calls are unsafe to flag — their values can be promises.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-unnecessary-await.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoUnnecessaryAwait struct{}

func (unicornNoUnnecessaryAwait) Name() string { return "unicorn/no-unnecessary-await" }
func (unicornNoUnnecessaryAwait) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindAwaitExpression}
}
func (unicornNoUnnecessaryAwait) Check(ctx *Context, node *shimast.Node) {
	await := node.AsAwaitExpression()
	if await == nil || await.Expression == nil {
		return
	}
	operand := stripParens(await.Expression)
	if operand == nil {
		return
	}
	switch operand.Kind {
	case shimast.KindStringLiteral,
		shimast.KindNumericLiteral,
		shimast.KindBigIntLiteral,
		shimast.KindNoSubstitutionTemplateLiteral,
		shimast.KindTemplateExpression,
		shimast.KindRegularExpressionLiteral,
		shimast.KindTrueKeyword,
		shimast.KindFalseKeyword,
		shimast.KindNullKeyword,
		shimast.KindArrayLiteralExpression,
		shimast.KindObjectLiteralExpression:
		ctx.Report(node, "Don't `await` a non-thenable expression.")
	}
}

func init() {
	Register(unicornNoUnnecessaryAwait{})
}
