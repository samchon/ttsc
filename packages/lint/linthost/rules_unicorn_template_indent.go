// unicorn/template-indent: re-indents the contents of tagged template
// literals (`outdent`, `dedent`, `stripIndent`, etc.) so the inner text
// is column-aligned with the surrounding code. The autofix has to
// detect the common leading-whitespace prefix of every line in the
// template body, decide what the desired indent level is from the
// template's own column, then rewrite every interior line — substantial
// whitespace analysis well beyond a pattern match.
//
// Registered as a no-op stub to keep
// `TestTypedKeysMatchRegisteredRules` aligned with the typed
// `ITtscLintUnicornRules` surface. The matching fixture under
// `tests/test-lint/src/cases/unicorn-template-indent.ts` keeps its
// `@ttsc-corpus-skip` directive.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/template-indent.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornTemplateIndent struct{}

func (unicornTemplateIndent) Name() string           { return "unicorn/template-indent" }
func (unicornTemplateIndent) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }
func (unicornTemplateIndent) Check(_ *Context, _ *shimast.Node) {
}

func init() {
	Register(unicornTemplateIndent{})
}
