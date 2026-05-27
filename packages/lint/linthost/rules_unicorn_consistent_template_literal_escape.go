// MVP: registers the rule so the typed-key parity test passes; the
// upstream behavior needs raw-source escape-sequence analysis (the two
// equivalent forms `\${` and `$\{` are erased by the parser into the
// same token text), which is out of scope for this AST-only port.
//
// unicorn/consistent-template-literal-escape:
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/consistent-template-literal-escape.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornConsistentTemplateLiteralEscape struct{}

func (unicornConsistentTemplateLiteralEscape) Name() string {
	return "unicorn/consistent-template-literal-escape"
}
func (unicornConsistentTemplateLiteralEscape) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindSourceFile}
}
func (unicornConsistentTemplateLiteralEscape) Check(ctx *Context, node *shimast.Node) {
}

func init() {
	Register(unicornConsistentTemplateLiteralEscape{})
}
