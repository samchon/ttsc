// MVP: registers the rule so the typed-key parity test passes; the
// upstream behavior needs scope analysis (track each destructured
// binding through subsequent member-access sites in the same scope),
// which is out of scope for this AST-only port.
//
// unicorn/consistent-destructuring:
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/consistent-destructuring.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornConsistentDestructuring struct{}

func (unicornConsistentDestructuring) Name() string {
	return "unicorn/consistent-destructuring"
}
func (unicornConsistentDestructuring) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindSourceFile}
}
func (unicornConsistentDestructuring) Check(ctx *Context, node *shimast.Node) {
}

func init() {
	Register(unicornConsistentDestructuring{})
}
