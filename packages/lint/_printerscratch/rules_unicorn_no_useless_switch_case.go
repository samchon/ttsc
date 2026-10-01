// unicorn/no-useless-switch-case: a `case` clause with no statements
// that sits immediately above the `default` clause falls through to
// `default` for free — the value it matches would have hit `default`
// regardless. Keeping the empty case adds noise without changing the
// switch's behavior, so the rule reports it.
//
// AST-only: visit each `SwitchStatement`, walk its case-block clauses,
// and report any non-default `CaseClause` whose statements list is
// empty and whose immediate next sibling is the `DefaultClause`. The
// empty-body check distinguishes intentional grouped cases that share a
// non-trivial body from the redundant fall-into-default shape.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-useless-switch-case.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoUselessSwitchCase struct{}

func (unicornNoUselessSwitchCase) Name() string { return "unicorn/no-useless-switch-case" }
func (unicornNoUselessSwitchCase) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSwitchStatement}
}
func (unicornNoUselessSwitchCase) Check(ctx *Context, node *shimast.Node) {
  sw := node.AsSwitchStatement()
  if sw == nil || sw.CaseBlock == nil {
    return
  }
  block := sw.CaseBlock.AsCaseBlock()
  if block == nil || block.Clauses == nil {
    return
  }
  clauses := block.Clauses.Nodes
  for i := 0; i < len(clauses)-1; i++ {
    clause := clauses[i]
    if clause == nil || clause.Kind != shimast.KindCaseClause {
      continue
    }
    next := clauses[i+1]
    if next == nil || next.Kind != shimast.KindDefaultClause {
      continue
    }
    cd := clause.AsCaseOrDefaultClause()
    if cd == nil {
      continue
    }
    if cd.Statements != nil && len(cd.Statements.Nodes) != 0 {
      continue
    }
    ctx.Report(clause, "Useless `case` clause — it falls through to the `default` which would handle this value anyway.")
  }
}

func init() {
  Register(unicornNoUselessSwitchCase{})
}
