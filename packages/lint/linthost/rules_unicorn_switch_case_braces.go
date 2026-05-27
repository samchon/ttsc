// unicorn/switch-case-braces: `case` and `default` clauses share their
// parent switch's scope, so an unbraced `case x: let y = …;` leaks `y`
// into every subsequent case. The default-on "always" mode of this rule
// requires every clause body to be a single `{ … }` block, which both
// scopes declarations and visually delimits clause bodies.
//
// AST-only: visit each `CaseClause` and `DefaultClause` and report when
// the clause's statements list is anything other than exactly one
// `Block`. Empty fall-through clauses (`case "a":` with no statements)
// also fire — the rule's "always" mode wants the brace pair even when
// the body is empty.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/switch-case-braces.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornSwitchCaseBraces struct{}

func (unicornSwitchCaseBraces) Name() string { return "unicorn/switch-case-braces" }
func (unicornSwitchCaseBraces) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindCaseClause, shimast.KindDefaultClause}
}
func (unicornSwitchCaseBraces) Check(ctx *Context, node *shimast.Node) {
	clause := node.AsCaseOrDefaultClause()
	if clause == nil || clause.Statements == nil {
		return
	}
	stmts := clause.Statements.Nodes
	if len(stmts) == 0 {
		// Empty fall-through (`case "a":` followed immediately by another
		// clause) is not the "missing braces" shape the rule targets.
		return
	}
	if len(stmts) == 1 && stmts[0] != nil && stmts[0].Kind == shimast.KindBlock {
		return
	}
	ctx.Report(node, "Wrap `case` clause body in a block (`case x: { ... }`).")
}

func init() {
	Register(unicornSwitchCaseBraces{})
}
