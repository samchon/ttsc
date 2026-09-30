package linthost

import "testing"

// TestRuleCorpusOperatorAssignment verifies the lint rule corpus fixture operator-assignment.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in operator-assignment.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original x = x + 1 while permitting already-compound assignment and a genuinely different right operand.
// @evidence contracts/testing.md#independent-expectations Equivalent self-target arithmetic can be written as +=; the independent annotation applies only when the target reappears as the left arithmetic operand.
// @evidence contracts/testing.md#distinguishing-cases The expanded self-target form reports; x += 1 and x = y + 1 remain clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusOperatorAssignment owns the original fixture, its assertions and any added control in the unit population. The shared Go unit runner invokes parsed-source Engine operations and direct edit application, with disposable fixture files where needed; no installed consumer, native build or product host runs.
func TestRuleCorpusOperatorAssignment(t *testing.T) {
  assertRuleCorpusCase(t, "operator-assignment.ts", "let x = 1;\nconsole.log(x);\n// expect: operator-assignment error\nx = x + 1;\nconsole.log(x);\n")
  assertRuleSkipsSource(t, "operator-assignment", "let x = 1; let y = 2; x += 1; x = y + 1;\n")
}
