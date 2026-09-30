package linthost

import "testing"

// TestRuleCorpusNoSetterReturn verifies the lint rule corpus fixture no-setter-return.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-setter-return.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports a setter returning a value and permits a bare early return.
// @evidence contracts/testing.md#independent-expectations Setter assignment ignores a returned value; the authored value-return versus bare-return distinction supplies the oracle.
// @evidence contracts/testing.md#distinguishing-cases String-valued return reports; bare return after reading the input stays clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoSetterReturn is selected in the shared Go unit population. It calls assertRuleCorpusCase with no-setter-return.ts through the owning Engine and assertRuleSkipsSource for the explicit clean input. No consumer install, native artifact build or real host runs.
func TestRuleCorpusNoSetterReturn(t *testing.T) {
  assertRuleCorpusCase(t, "no-setter-return.ts", "class Holder {\n  set value(input: string) {\n    JSON.stringify(input);\n    // expect: no-setter-return error\n    return \"ignored\";\n  }\n}\n")
  assertRuleSkipsSource(t, "no-setter-return", "class Holder { set value(input: string) { if (!input) return; log(input); } }\n")
}
