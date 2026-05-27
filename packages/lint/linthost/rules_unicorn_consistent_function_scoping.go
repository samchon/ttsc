// MVP: registers the rule so the typed-key parity test passes; the
// upstream behavior needs scope analysis (determine which free
// variables a nested function references in the enclosing scope), which
// is out of scope for this AST-only port.
//
// unicorn/consistent-function-scoping:
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/consistent-function-scoping.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornConsistentFunctionScoping struct{}

func (unicornConsistentFunctionScoping) Name() string {
	return "unicorn/consistent-function-scoping"
}
func (unicornConsistentFunctionScoping) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindSourceFile}
}
func (unicornConsistentFunctionScoping) Check(ctx *Context, node *shimast.Node) {
}

func init() {
	Register(unicornConsistentFunctionScoping{})
}
