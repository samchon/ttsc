package linthost

import "testing"

// TestRuleCorpusNoUnsafeFunctionType verifies the lint rule corpus fixture no-unsafe-function-type.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-unsafe-function-type.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
// @evidence contracts/testing.md#behavioral-verification The unspecific Function type must report.
// @evidence contracts/testing.md#independent-expectations The independently authored fixture markers require exactly typescript/no-unsafe-function-type error findings at lines 2; complete rule/severity/line comparison rejects missing, extra or misidentified reports.
// @evidence contracts/testing.md#distinguishing-cases An explicit callable signature remains clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoUnsafeFunctionType executes the AST Engine through assertRuleCorpusCase and an independently authored zero-finding counterpart through assertRuleSkipsSource in the same Go unit process; no native build, installation or compiler child runs.
func TestRuleCorpusNoUnsafeFunctionType(t *testing.T) {
  assertRuleCorpusCase(t, "no-unsafe-function-type.ts", "// expect: typescript/no-unsafe-function-type error\ntype Callback = Function;\n\nJSON.stringify({} as Callback);\n")
  assertRuleSkipsSource(t, "typescript/no-unsafe-function-type", "type Callback = () => void;\n")
}
