package linthost

import "testing"

// TestRuleCorpusUnicornNoThisAssignment verifies unicorn/no-this-assignment
// reports a `const self = this;` capture.
//
// The rule visits `KindVariableDeclaration` and checks whether the
// initializer (after stripping parentheses) is the `this` keyword. The
// fixture wraps the capture in a class method so the `this` keyword has a
// realistic binding context and the rule's anchor falls on the declaration.
//
// 1. Enable unicorn/no-this-assignment via an expect annotation.
// 2. Declare `const self = this;` inside a class method body.
// 3. Assert the declaration is reported.
func TestRuleCorpusUnicornNoThisAssignment(t *testing.T) {
	assertRuleCorpusCase(t, "unicorn/no-this-assignment.ts", "class C {\n  m() {\n    // expect: unicorn/no-this-assignment error\n    const self = this;\n    return self;\n  }\n}\n")
}
