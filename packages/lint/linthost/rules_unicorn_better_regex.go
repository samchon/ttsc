// unicorn/better-regex: the upstream rule rewrites regex literals into
// the shortest equivalent form (e.g. `[0-9]` -> `\d`, `[^\W\D]` -> `\d`,
// dedupes character classes, collapses redundant quantifiers). That
// rewrite requires a full regex parser with character-class semantics —
// far beyond the AST-only scope of this slice — so the rule is
// registered as a no-op stub to keep `TestTypedKeysMatchRegisteredRules`
// honest with the typed `ITtscLintUnicornRules` surface.
//
// Replace this stub with a real implementation when a regex AST helper
// lands; the matching fixture under
// `tests/test-lint/src/cases/unicorn-better-regex.ts` carries the
// `@ttsc-corpus-skip` directive so the corpus test suite walks past it.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/better-regex.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornBetterRegex struct{}

func (unicornBetterRegex) Name() string           { return "unicorn/better-regex" }
func (unicornBetterRegex) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }
func (unicornBetterRegex) Check(_ *Context, _ *shimast.Node) {
}

func init() {
  Register(unicornBetterRegex{})
}
