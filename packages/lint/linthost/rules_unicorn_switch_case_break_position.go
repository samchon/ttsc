// unicorn/switch-case-break-position: the upstream rule rejects a
// `break` / `return` / `throw` that is followed by further statements
// inside the same `case` / `default` clause, because the trailing
// statements are dead code.
//
// In a well-formed TypeScript program the TypeScript-Go checker already
// emits an `unreachable code` diagnostic for statements following a
// terminator, so this AST-only port would either duplicate that
// diagnostic (when reused as an MVP) or need scope/CFG analysis to
// reproduce the exact upstream surface. The rule is registered as a
// no-op until a follow-up exposes the unreachable-statement metadata
// the checker computes for switch clauses.
//
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/switch-case-break-position.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornSwitchCaseBreakPosition struct{}

func (unicornSwitchCaseBreakPosition) Name() string {
  return "unicorn/switch-case-break-position"
}
func (unicornSwitchCaseBreakPosition) Visits() []shimast.Kind { return nil }
func (unicornSwitchCaseBreakPosition) Check(*Context, *shimast.Node) {
  // Intentionally empty; see file-level comment.
}

func init() {
  Register(unicornSwitchCaseBreakPosition{})
}
