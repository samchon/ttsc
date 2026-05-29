// unicorn/filename-case: enforces a single case convention (kebab,
// camel, snake, or pascal) on every source file name. The MVP target
// would be kebab-case, but the in-tree test fixture for this rule
// lives at `tests/test-lint/src/cases/unicorn-filename-case.ts` —
// which is already kebab-case — so the rule would never fire on its
// own fixture and the corpus test would have no positive case to
// assert on. A proper port also needs a way to influence the
// fixture's virtual filename from the harness, which is not exposed
// today.
//
// Registered as a no-op stub to keep
// `TestTypedKeysMatchRegisteredRules` aligned with the typed
// `ITtscLintUnicornRules` surface. The fixture keeps its
// `@ttsc-corpus-skip` directive.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/filename-case.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornFilenameCase struct{}

func (unicornFilenameCase) Name() string           { return "unicorn/filename-case" }
func (unicornFilenameCase) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }
func (unicornFilenameCase) Check(_ *Context, _ *shimast.Node) {
}

func init() {
  Register(unicornFilenameCase{})
}
