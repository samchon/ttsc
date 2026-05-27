// unicorn/no-unnecessary-polyfills: rejects imports of polyfill
// packages (`core-js/…`, `es6-promise`, …) for APIs the project's
// targeted runtime already supports natively. The signal is "this
// dependency is dead weight for our `engines.node` / `browserslist`
// floor".
//
// Escape-hatch / no-op port: the rule needs two external inputs the
// AST-only engine in this package does not yet have a place for: the
// project's targeted runtime baseline (read upstream from
// `package.json#engines`, `browserslist`, or a rule option) and a
// curated polyfill-package → API map kept in lockstep with caniuse /
// MDN. Until both are wired through the linthost configuration, firing
// would either be uninformed (no baseline) or wrong (stale map).
// Registered so the typed-key/Go-registry parity check passes and so
// users can configure the rule, but it intentionally reports nothing
// until the inputs land in a follow-up.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-unnecessary-polyfills.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoUnnecessaryPolyfills struct{}

func (unicornNoUnnecessaryPolyfills) Name() string           { return "unicorn/no-unnecessary-polyfills" }
func (unicornNoUnnecessaryPolyfills) Visits() []shimast.Kind { return nil }
func (unicornNoUnnecessaryPolyfills) Check(_ *Context, _ *shimast.Node) {
  // Intentionally empty — see file header for the escape-hatch rationale.
}

func init() {
  Register(unicornNoUnnecessaryPolyfills{})
}
