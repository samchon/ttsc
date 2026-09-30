package linthost

import "testing"

// TestRuleCorpusNoDeleteVar verifies the lint rule corpus fixture no-delete-var.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-delete-var.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports deleting the original identifier binding while allowing deletion of an object member.
// @evidence contracts/testing.md#independent-expectations A variable binding is not a removable object property; the independently authored annotation selects delete a rather than all delete expressions.
// @evidence contracts/testing.md#distinguishing-cases The binding operand reports; dot and computed member operands stay clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoDeleteVar owns the original fixture, its assertions and any added control in the unit population. The shared Go unit runner invokes parsed-source Engine operations and direct edit application, with disposable fixture files where needed; no installed consumer, native build or product host runs.
func TestRuleCorpusNoDeleteVar(t *testing.T) {
  assertRuleCorpusCase(t, "no-delete-var.ts", "let a: any = 1;\n// expect: no-delete-var error\ndelete a;\nJSON.stringify(a);\n")
  assertRuleSkipsSource(t, "no-delete-var", "const obj: any = {}; delete obj.key; delete obj[\"key\"];\n")
}
