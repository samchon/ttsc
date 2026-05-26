package linthost

import "testing"

// TestFunctionalNoThisExpressionsRejectsThis verifies functional/no-this-expressions rejects this.
//
// `this` binds behavior to ambient object state. The rule reports the keyword
// directly so class and object-method cases share one AST path.
//
// 1. Parse a this expression.
// 2. Enable only functional/no-this-expressions.
// 3. Assert the expression reports and offers no autofix.
func TestFunctionalNoThisExpressionsRejectsThis(t *testing.T) {
	const ruleName = "functional/no-this-expressions"
	findings := runFunctionalRule(t, ruleName, `this.value;`)
	assertFunctionalFinding(t, ruleName, findings, "this")
}
