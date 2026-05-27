// switchExhaustivenessCheck reports `switch (e)` statements where the
// discriminant is a union of literal types or an enum and at least one
// constituent has no matching `case` clause AND the switch carries no
// `default` clause. Either covering every member explicitly or adding a
// `default` arm makes the intent visible and forces the compiler to
// flag any future addition to the union/enum at every switch site.
// typescript-eslint strict-type-checked:
// https://typescript-eslint.io/rules/switch-exhaustiveness-check/
package linthost

import (
	shimast "github.com/microsoft/typescript-go/shim/ast"
	shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

// switchExhaustivenessCheck is type-aware: the discriminant is resolved
// via the Checker, and uncovered members are computed by removing every
// case-clause expression's type from the union's constituent set. The
// rule only fires when the discriminant resolves to a union — plain
// `string` or `number` discriminants are open-ended and outside the
// rule's scope, matching typescript-eslint's behavior.
//
// Identity is established by `*Type` pointer comparison rather than
// literal value comparison: TypeScript canonicalizes string and number
// literal types (`stringLiteralTypes` / `numberLiteralTypes` maps inside
// the checker), so two references to `"a"` resolve to the same `*Type`
// instance. Enum literal types are likewise canonicalized per enum
// member, so `case E.A:` and the `E.A` constituent of the discriminant's
// union share their `*Type` pointer.
type switchExhaustivenessCheck struct{}

func (switchExhaustivenessCheck) Name() string { return "typescript/switch-exhaustiveness-check" }
func (switchExhaustivenessCheck) NeedsTypeChecker() bool {
	return true
}
func (switchExhaustivenessCheck) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindSwitchStatement}
}
func (switchExhaustivenessCheck) Check(ctx *Context, node *shimast.Node) {
	if ctx.Checker == nil {
		return
	}
	sw := node.AsSwitchStatement()
	if sw == nil || sw.Expression == nil || sw.CaseBlock == nil {
		return
	}
	block := sw.CaseBlock.AsCaseBlock()
	if block == nil || block.Clauses == nil {
		return
	}
	// A `default` clause covers anything not enumerated above, so the
	// rule has nothing to add. typescript-eslint also exits early in
	// this case.
	for _, clause := range block.Clauses.Nodes {
		if clause != nil && clause.Kind == shimast.KindDefaultClause {
			return
		}
	}
	discriminantType := ctx.Checker.GetTypeAtLocation(sw.Expression)
	if discriminantType == nil {
		return
	}
	// Only consider discriminants whose static type is a finite union of
	// literal-like constituents. Plain `string` / `number` / `unknown`
	// are open-ended and never exhaustively coverable.
	members := switchExhaustivenessCheckCollectMembers(discriminantType)
	if len(members) == 0 {
		return
	}
	covered := make(map[*shimchecker.Type]bool, len(members))
	for _, clause := range block.Clauses.Nodes {
		if clause == nil || clause.Kind != shimast.KindCaseClause {
			continue
		}
		caseClause := clause.AsCaseOrDefaultClause()
		if caseClause == nil || caseClause.Expression == nil {
			continue
		}
		caseType := ctx.Checker.GetTypeAtLocation(caseClause.Expression)
		if caseType == nil {
			continue
		}
		covered[caseType] = true
	}
	missing := 0
	for _, member := range members {
		if !covered[member] {
			missing++
		}
	}
	if missing == 0 {
		return
	}
	ctx.Report(node, "Switch is not exhaustive. Cases not matched: add a `case` for every union/enum member, or include a `default` clause.")
}

// switchExhaustivenessCheckCollectMembers returns the finite literal /
// enum-literal constituents of t when t is a discriminable union, and
// nil when t is open-ended (plain `string`, `number`, `any`, `unknown`,
// etc.). A union whose constituents are all literals or enum literals
// is treated as exhaustively coverable; any non-literal constituent
// (e.g. `string` mixed into `"a" | "b" | string`) widens the union and
// disqualifies the whole discriminant.
func switchExhaustivenessCheckCollectMembers(t *shimchecker.Type) []*shimchecker.Type {
	if t == nil {
		return nil
	}
	flags := t.Flags()
	if flags&shimchecker.TypeFlagsUnion == 0 {
		return nil
	}
	parts := t.Types()
	if len(parts) == 0 {
		return nil
	}
	members := make([]*shimchecker.Type, 0, len(parts))
	for _, part := range parts {
		if part == nil {
			return nil
		}
		if !switchExhaustivenessCheckIsLiteralLike(part) {
			return nil
		}
		members = append(members, part)
	}
	return members
}

// switchExhaustivenessCheckIsLiteralLike reports whether t is a
// constituent that participates in finite enumeration: a unit type
// (string/number/bigint/boolean literal), an enum literal, or one of
// the nullish singletons. The matching set mirrors typescript-eslint's
// `lib.isTypeFlagSet(constituent, TypeFlags.Literal | ...)` filter.
func switchExhaustivenessCheckIsLiteralLike(t *shimchecker.Type) bool {
	flags := t.Flags()
	if flags&shimchecker.TypeFlagsLiteral != 0 {
		return true
	}
	if flags&(shimchecker.TypeFlagsUndefined|shimchecker.TypeFlagsNull|shimchecker.TypeFlagsVoid) != 0 {
		return true
	}
	return false
}

func init() {
	Register(switchExhaustivenessCheck{})
}
