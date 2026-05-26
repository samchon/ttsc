package linthost

import "testing"

// TestFunctionalParametersRejectsRestParameter verifies functional/functional-parameters
// rejects rest parameters by default.
//
// Rest parameters are often used as mutable argument bags. The native policy
// keeps the first slice conservative by flagging the syntax directly without
// needing type information.
//
// 1. Parse a function with a rest parameter.
// 2. Enable only functional/functional-parameters.
// 3. Assert the rest parameter reports and offers no autofix.
func TestFunctionalParametersRejectsRestParameter(t *testing.T) {
	const ruleName = "functional/functional-parameters"
	findings := runFunctionalRule(t, ruleName, `function collect(...items: string[]) { return items; }`)
	assertFunctionalFinding(t, ruleName, findings, "rest parameter")
}
