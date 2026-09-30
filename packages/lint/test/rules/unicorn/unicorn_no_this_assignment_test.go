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
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run through assertRuleCorpusCase verifies a declaration aliases this into self; literal annotations compare the exact rule, severity and source line, including absence of extra findings.
// @evidence contracts/testing.md#independent-expectations The authored unicorn/no-this-assignment annotation follows the supported policy described above; the separately authored accepted source has a literal zero-finding oracle and is not generated from product output.
// @evidence contracts/testing.md#distinguishing-cases The original reported input is retained; a return accesses this directly without creating an alias. Both source fixtures execute in this named entry.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoThisAssignment is a discoverable Go unit entry. Its virtual TypeScript ASTs exercise the owning lint engine in the shared Go process, without consumer installation, native build or product host.
func TestRuleCorpusUnicornNoThisAssignment(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/no-this-assignment.ts", "class C {\n  m() {\n    // expect: unicorn/no-this-assignment error\n    const self = this;\n    return self;\n  }\n}\n")
  assertRuleSkipsSource(t, "unicorn/no-this-assignment", "class C { m() { return this; } }\n")
}
