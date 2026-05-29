// noRestrictedSyntax: a project-level escape hatch that lets a team
// ban specific AST node kinds outright. Upstream ESLint accepts an
// arbitrary selector list and a per-entry message; without the
// rule-options plumbing, this baseline ships a fixed default set that
// covers the two syntactic constructs almost every modern TypeScript
// project forbids: `with` (replaced by destructuring / explicit access
// long ago) and labeled statements (used only to bridge complex
// nested loops, which are themselves better refactored). The full
// configurable surface is deferred — projects that need a custom
// denylist can stack additional rules until option decoding lands.
// https://eslint.org/docs/latest/rules/no-restricted-syntax
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// noRestrictedSyntaxDefault is the built-in denylist surfaced when no
// config is supplied. Each entry pairs a banned node kind with the
// short, actionable message reported at the offending node.
var noRestrictedSyntaxDefault = map[shimast.Kind]string{
  shimast.KindWithStatement:    "`with` statements are restricted — use explicit property access instead.",
  shimast.KindLabeledStatement: "Labeled statements are restricted — refactor the surrounding control flow instead.",
}

type noRestrictedSyntax struct{}

func (noRestrictedSyntax) Name() string { return "no-restricted-syntax" }
func (noRestrictedSyntax) Visits() []shimast.Kind {
  kinds := make([]shimast.Kind, 0, len(noRestrictedSyntaxDefault))
  for kind := range noRestrictedSyntaxDefault {
    kinds = append(kinds, kind)
  }
  return kinds
}
func (noRestrictedSyntax) Check(ctx *Context, node *shimast.Node) {
  if node == nil {
    return
  }
  message, banned := noRestrictedSyntaxDefault[node.Kind]
  if !banned {
    return
  }
  ctx.Report(node, message)
}

func init() {
  Register(noRestrictedSyntax{})
}
