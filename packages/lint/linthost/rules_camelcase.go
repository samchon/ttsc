// camelcase reports declaration names that are neither camelCase nor
// PascalCase. snake_case bindings are the canonical failure: the
// underscore between two letters signals a non-JavaScript naming
// convention and the rule pushes authors back to the language norm.
// https://eslint.org/docs/latest/rules/camelcase
//
// Conservative baseline: only the four declaration kinds the ESLint
// rule documents as in-scope are inspected — variable, function, class,
// and parameter declarations. Each is checked through its `Name()`
// accessor so destructuring patterns and computed property names are
// skipped automatically (they return non-Identifier nodes). Leading
// and trailing underscores plus a single all-uppercase form
// (`MAX_VALUE`) are tolerated because ESLint exempts them too.
package linthost

import (
	shimast "github.com/microsoft/typescript-go/shim/ast"
)

type camelcase struct{}

func (camelcase) Name() string { return "camelcase" }
func (camelcase) Visits() []shimast.Kind {
	return []shimast.Kind{
		shimast.KindVariableDeclaration,
		shimast.KindParameter,
		shimast.KindFunctionDeclaration,
		shimast.KindClassDeclaration,
	}
}
func (camelcase) Check(ctx *Context, node *shimast.Node) {
	var nameNode *shimast.Node
	switch node.Kind {
	case shimast.KindVariableDeclaration:
		decl := node.AsVariableDeclaration()
		if decl == nil {
			return
		}
		nameNode = decl.Name()
	case shimast.KindParameter:
		decl := node.AsParameterDeclaration()
		if decl == nil {
			return
		}
		nameNode = decl.Name()
	case shimast.KindFunctionDeclaration:
		decl := node.AsFunctionDeclaration()
		if decl == nil {
			return
		}
		nameNode = decl.Name()
	case shimast.KindClassDeclaration:
		decl := node.AsClassDeclaration()
		if decl == nil {
			return
		}
		nameNode = decl.Name()
	}
	name := identifierText(nameNode)
	if name == "" {
		return
	}
	if isCamelOrPascalCaseName(name) {
		return
	}
	ctx.Report(nameNode, "Identifier '"+name+"' is not in camelCase.")
}

// isCamelOrPascalCaseName reports whether `name` matches the convention
// the rule accepts. The canonical violation is a snake_case binding —
// an underscore wedged between two letters — so the predicate inspects
// the trimmed interior of the name. Leading and trailing underscores
// are stripped first (`_foo`, `foo__`) because ESLint deliberately
// allows the private-prefix and trailing-underscore conventions. An
// all-uppercase residue (`MAX_VALUE` → `MAX_VALUE`) is treated as a
// SCREAMING_SNAKE constant and accepted; everything else with an
// interior underscore is reported.
func isCamelOrPascalCaseName(name string) bool {
	if name == "" {
		return true
	}
	trimmed := trimUnderscores(name)
	if trimmed == "" {
		return true
	}
	if !containsUnderscore(trimmed) {
		return true
	}
	return isAllUpperOrUnderscore(trimmed)
}

func trimUnderscores(s string) string {
	start, end := 0, len(s)
	for start < end && s[start] == '_' {
		start++
	}
	for end > start && s[end-1] == '_' {
		end--
	}
	return s[start:end]
}

func containsUnderscore(s string) bool {
	for i := 0; i < len(s); i++ {
		if s[i] == '_' {
			return true
		}
	}
	return false
}

// isAllUpperOrUnderscore returns true when every character is either an
// uppercase ASCII letter, a digit, or an underscore. Lowercase letters
// disqualify the string and force the rule to report.
func isAllUpperOrUnderscore(s string) bool {
	hasUpper := false
	for i := 0; i < len(s); i++ {
		ch := s[i]
		switch {
		case ch >= 'A' && ch <= 'Z':
			hasUpper = true
		case ch >= '0' && ch <= '9':
		case ch == '_':
		default:
			return false
		}
	}
	return hasUpper
}

func init() {
	Register(camelcase{})
}
