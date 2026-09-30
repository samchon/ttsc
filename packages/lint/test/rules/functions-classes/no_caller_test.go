package linthost

import "testing"

// TestRuleCorpusNoCaller verifies the lint rule corpus fixture no-caller.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-caller.ts and compares normalized rule,
// severity, and line triples. The source text stays embedded in the generated Go file so the
// test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports arguments.callee and permits ordinary access to a positional argument.
// @evidence contracts/testing.md#independent-expectations The restricted caller/callee introspection policy independently selects callee rather than every arguments member.
// @evidence contracts/testing.md#distinguishing-cases arguments.callee reports; arguments[0] stays clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoCaller is selected in the shared Go unit population. It calls assertRuleCorpusCase with no-caller.ts through the owning Engine and assertRuleSkipsSource for the explicit clean input. No consumer install, native artifact build or real host runs.
func TestRuleCorpusNoCaller(t *testing.T) {
  assertRuleCorpusCase(t, "no-caller.ts", "function f() {\n  // expect: no-caller error\n  return arguments.callee;\n}\nJSON.stringify(f);\n")
  assertRuleSkipsSource(t, "no-caller", "function f() { return arguments[0]; }\n")
}
