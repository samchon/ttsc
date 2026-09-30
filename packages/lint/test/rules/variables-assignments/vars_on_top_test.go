package linthost

import "testing"

// TestRuleCorpusVarsOnTop verifies the lint rule corpus fixture vars-on-top.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in vars-on-top.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original function-local var appearing after console output while permitting a leading declaration.
// @evidence contracts/testing.md#independent-expectations The placement policy requires function var declarations before executable statements; authored annotation identifies the delayed declaration rather than testing file arrangement.
// @evidence contracts/testing.md#distinguishing-cases The after-output var reports; a first-statement var stays clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusVarsOnTop owns the original fixture, its assertions and any added control in the unit population. The shared Go unit runner invokes parsed-source Engine operations and direct edit application, with disposable fixture files where needed; no installed consumer, native build or product host runs.
func TestRuleCorpusVarsOnTop(t *testing.T) {
  assertRuleCorpusCase(t, "vars-on-top.ts", "function f() {\n  console.log(\"hi\");\n  // expect: vars-on-top error\n  var a = 1;\n  JSON.stringify(a);\n}\nf();\n")
  assertRuleSkipsSource(t, "vars-on-top", "function f() { var a = 1; console.log(a); }\n")
}
