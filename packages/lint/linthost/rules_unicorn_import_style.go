// unicorn/import-style: forbids named or default imports from configured
// modules so that, for example, `path` is always imported as the
// namespace `path` and never destructured. The rule's behavior is
// entirely driven by a per-module configuration map
// (`styles: { foo: { default: false, namespace: true } }`). Without that
// configuration plumbing landing in the host's rule-options pipeline,
// the rule has no defaults to enforce, so it is registered as a no-op
// stub to keep `TestTypedKeysMatchRegisteredRules` aligned with the
// typed `ITtscLintUnicornRules` surface.
//
// The matching fixture under
// `tests/test-lint/src/cases/unicorn-import-style.ts` keeps its
// `@ttsc-corpus-skip` directive until the configuration plumbing lands.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/import-style.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornImportStyle struct{}

func (unicornImportStyle) Name() string           { return "unicorn/import-style" }
func (unicornImportStyle) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }
func (unicornImportStyle) Check(_ *Context, _ *shimast.Node) {
}

func init() {
	Register(unicornImportStyle{})
}
