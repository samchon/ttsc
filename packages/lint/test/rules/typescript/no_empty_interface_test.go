package linthost

import "testing"

// TestRuleCorpusNoEmptyInterface verifies the lint rule corpus fixture no-empty-interface.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-empty-interface.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
// @evidence contracts/testing.md#behavioral-verification An empty interface must report.
// @evidence contracts/testing.md#independent-expectations The original authored expect marker fixes exactly one typescript/no-empty-interface error at line 2; assertRuleCorpusCase compares complete rule/severity/line triples, while the independently authored counterpart requires zero findings.
// @evidence contracts/testing.md#distinguishing-cases An interface with a declared member remains clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoEmptyInterface invokes the AST Engine through assertRuleCorpusCase and the registered rule through assertRuleSkipsSource in one Go unit process; no installation, child compiler or native plugin build executes.
func TestRuleCorpusNoEmptyInterface(t *testing.T) {
  assertRuleCorpusCase(t, "no-empty-interface.ts", "// expect: typescript/no-empty-interface error\ninterface Empty {}\nconst e: Empty = {};\nJSON.stringify(e);\n")
  assertRuleSkipsSource(t, "typescript/no-empty-interface", "interface Shape { name: string; }\n")
}
