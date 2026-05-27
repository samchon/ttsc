// unicorn/isolated-functions: flags function expressions that "escape"
// their lexical closure unintentionally — e.g. an inner function that
// references no outer binding but is still placed at the inner scope.
// Correctly identifying "isolated function" context requires scope
// analysis tracking what each nested function captures, which is not
// available in the AST-only slice of this port.
//
// Registered as a no-op stub to keep
// `TestTypedKeysMatchRegisteredRules` aligned with the typed
// `ITtscLintUnicornRules` surface. The matching fixture under
// `tests/test-lint/src/cases/unicorn-isolated-functions.ts` keeps its
// `@ttsc-corpus-skip` directive.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/isolated-functions.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornIsolatedFunctions struct{}

func (unicornIsolatedFunctions) Name() string { return "unicorn/isolated-functions" }
func (unicornIsolatedFunctions) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindSourceFile}
}
func (unicornIsolatedFunctions) Check(_ *Context, _ *shimast.Node) {
}

func init() {
	Register(unicornIsolatedFunctions{})
}
