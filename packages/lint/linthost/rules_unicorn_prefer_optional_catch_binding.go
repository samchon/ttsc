// unicorn/prefer-optional-catch-binding: ES2019 introduced optional
// catch bindings (`catch { ... }`) so that catch clauses that never
// reference the thrown error don't need to declare a binding at all.
// Holding onto the binding name keeps a dead local variable in source
// and signals that the catch body still cares about the error when in
// fact it doesn't.
//
// AST-only: visit each `CatchClause`, restrict to the common-case
// binding names `e` and `error` (true scope analysis would require a
// resolver), and confirm the body's source text does not contain the
// binding name as a word-bounded identifier. The previous substring
// scan was load-bearing-wrong: `strings.Contains(body, "e")` matches
// nearly any English identifier, hiding the rule entirely; word
// boundaries (`\bname\b`) correctly distinguish `e` from `error`,
// `error` from `errorMessage`, etc. False positives on `name` inside
// string literals or comments are acceptable because the rule is
// conservative by design.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/prefer-optional-catch-binding.md
package linthost

import (
	"regexp"

	shimast "github.com/microsoft/typescript-go/shim/ast"
)

var unicornPreferOptionalCatchBindingNamePattern = map[string]*regexp.Regexp{
	"e":     regexp.MustCompile(`\be\b`),
	"error": regexp.MustCompile(`\berror\b`),
}

type unicornPreferOptionalCatchBinding struct{}

func (unicornPreferOptionalCatchBinding) Name() string {
	return "unicorn/prefer-optional-catch-binding"
}
func (unicornPreferOptionalCatchBinding) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindCatchClause}
}
func (unicornPreferOptionalCatchBinding) Check(ctx *Context, node *shimast.Node) {
	catch := node.AsCatchClause()
	if catch == nil || catch.VariableDeclaration == nil || catch.Block == nil {
		return
	}
	binding := catch.VariableDeclaration.Name()
	if binding == nil || binding.Kind != shimast.KindIdentifier {
		return
	}
	name := identifierText(binding)
	pattern, ok := unicornPreferOptionalCatchBindingNamePattern[name]
	if !ok {
		return
	}
	if pattern.MatchString(nodeText(ctx.File, catch.Block)) {
		return
	}
	ctx.Report(binding, "Prefer optional catch binding `catch { ... }` when the error is unused.")
}

func init() {
	Register(unicornPreferOptionalCatchBinding{})
}
