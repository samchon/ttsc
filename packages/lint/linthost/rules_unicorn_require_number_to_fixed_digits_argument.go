// unicorn/require-number-to-fixed-digits-argument: `Number#toFixed()`
// with no argument is equivalent to `.toFixed(0)`, which rounds away
// every fractional digit. Authors almost always mean a non-zero digit
// count, and the no-arg form is one of the more common silent
// truncation bugs. The rule asks every call site to spell out the digit
// count.
//
// AST-only: visit each `CallExpression`, accept only the property-access
// `x.toFixed` shape, and report when the call carries zero arguments.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/require-number-to-fixed-digits-argument.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornRequireNumberToFixedDigitsArgument struct{}

func (unicornRequireNumberToFixedDigitsArgument) Name() string {
	return "unicorn/require-number-to-fixed-digits-argument"
}
func (unicornRequireNumberToFixedDigitsArgument) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindCallExpression}
}
func (unicornRequireNumberToFixedDigitsArgument) Check(ctx *Context, node *shimast.Node) {
	call := node.AsCallExpression()
	if call == nil || call.Expression == nil || call.Expression.Kind != shimast.KindPropertyAccessExpression {
		return
	}
	access := call.Expression.AsPropertyAccessExpression()
	if access == nil {
		return
	}
	if identifierText(access.Name()) != "toFixed" {
		return
	}
	if call.Arguments != nil && len(call.Arguments.Nodes) > 0 {
		return
	}
	ctx.Report(node, "Pass an explicit digits argument to `Number#toFixed()`.")
}

func init() {
	Register(unicornRequireNumberToFixedDigitsArgument{})
}
