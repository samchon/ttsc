// unicorn/string-content: rewrites configured substrings inside string
// literals (e.g. straight quotes -> curly quotes, `...` -> `…`). The
// rule has NO defaults; behavior depends entirely on the user-supplied
// `patterns: { match: replacement }` configuration. Without that
// per-pattern configuration plumbing in the host's rule-options
// pipeline, the rule has nothing to enforce.
//
// Registered as a no-op stub to keep
// `TestTypedKeysMatchRegisteredRules` aligned with the typed
// `ITtscLintUnicornRules` surface. The matching fixture under
// `tests/test-lint/src/cases/unicorn-string-content.ts` keeps its
// `@ttsc-corpus-skip` directive.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/string-content.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornStringContent struct{}

func (unicornStringContent) Name() string           { return "unicorn/string-content" }
func (unicornStringContent) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }
func (unicornStringContent) Check(_ *Context, _ *shimast.Node) {
}

func init() {
  Register(unicornStringContent{})
}
