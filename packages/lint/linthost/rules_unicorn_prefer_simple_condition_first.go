// unicorn/prefer-simple-condition-first: when a `&&`/`||` chain mixes
// a "simple" operand (a bare identifier, a small literal comparison)
// with a "complex" one (a function call, a property chain), short-
// circuit evaluation reads more naturally if the simple operand sits
// to the left — the cheap test is the gate, the expensive test runs
// only if the gate passes.
//
// Escape-hatch / no-op port: ranking arbitrary expressions by
// "simpleness" requires a stable complexity heuristic the upstream rule
// embeds across hundreds of lines (literal counts, identifier depth,
// call-chain weight, parenthesization). Without a faithful port of that
// heuristic the rule would either over-fire on equally-weighted operands
// or under-fire on the cases it is meant to catch; either way users get
// confusing diagnostics. Registered so the typed-key/Go-registry parity
// check passes and so users can configure the rule, but it intentionally
// reports nothing until the heuristic lands in a follow-up.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-simple-condition-first.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornPreferSimpleConditionFirst struct{}

func (unicornPreferSimpleConditionFirst) Name() string {
  return "unicorn/prefer-simple-condition-first"
}
func (unicornPreferSimpleConditionFirst) Visits() []shimast.Kind { return nil }
func (unicornPreferSimpleConditionFirst) Check(_ *Context, _ *shimast.Node) {
  // Intentionally empty — see file header for the escape-hatch rationale.
}

func init() {
  Register(unicornPreferSimpleConditionFirst{})
}
