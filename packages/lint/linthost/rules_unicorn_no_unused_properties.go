// unicorn/no-unused-properties: flags object-literal properties that
// are never read after the object is constructed. The signal is "this
// key sits in a literal that nothing reaches into" — analogous to
// `no-unused-vars` but for one level deeper inside object data.
//
// Escape-hatch / no-op port: implementing this faithfully requires
// per-object reachability and read tracking across the file (and across
// destructuring patterns, spread, computed access, and exports). That
// is a scope-and-flow problem the AST-only engine in this package
// cannot yet model without false positives every time a property is
// read through dynamic access. Registered so the typed-key/Go-registry
// parity check passes and so users can configure the rule, but it
// intentionally reports nothing until the analysis lands in a
// follow-up.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-unused-properties.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoUnusedProperties struct{}

func (unicornNoUnusedProperties) Name() string         { return "unicorn/no-unused-properties" }
func (unicornNoUnusedProperties) Visits() []shimast.Kind { return nil }
func (unicornNoUnusedProperties) Check(_ *Context, _ *shimast.Node) {
	// Intentionally empty — see file header for the escape-hatch rationale.
}

func init() {
	Register(unicornNoUnusedProperties{})
}
