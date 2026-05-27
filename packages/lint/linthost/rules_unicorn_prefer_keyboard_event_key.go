// unicorn/prefer-keyboard-event-key: `KeyboardEvent#keyCode`,
// `KeyboardEvent#charCode`, and `KeyboardEvent#which` are all
// deprecated. They expose layout-dependent integer codes that change
// across browsers and keyboard layouts and force code to maintain
// magic-number tables. `KeyboardEvent#key` returns the resolved key
// label as a string and is the spec-blessed replacement.
//
// AST-only: visit `PropertyAccessExpression` and match the right-hand
// identifier name against the deprecated property set. The receiver
// is intentionally not type-checked — the rule accepts the syntactic
// shape as the signal, which produces a small number of harmless
// false positives on non-event objects but is the correct trade for
// an AST-only port.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-keyboard-event-key.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferKeyboardEventKey struct{}

func (unicornPreferKeyboardEventKey) Name() string { return "unicorn/prefer-keyboard-event-key" }
func (unicornPreferKeyboardEventKey) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindPropertyAccessExpression}
}
func (unicornPreferKeyboardEventKey) Check(ctx *Context, node *shimast.Node) {
	access := node.AsPropertyAccessExpression()
	if access == nil {
		return
	}
	switch identifierText(access.Name()) {
	case "keyCode", "charCode", "which":
		ctx.Report(node, "Prefer `KeyboardEvent#key` over the deprecated `keyCode` / `charCode` / `which`.")
	}
}

func init() {
	Register(unicornPreferKeyboardEventKey{})
}
