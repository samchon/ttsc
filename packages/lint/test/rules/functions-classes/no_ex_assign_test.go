package main

import "testing"

// TestRuleCorpusNoExAssign verifies the lint rule corpus fixture no-ex-assign.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-ex-assign.ts and compares normalized
// rule, severity, and line triples. The source text stays embedded in the generated Go file so
// the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusNoExAssign(t *testing.T) {
  assertRuleCorpusCase(t, "no-ex-assign.ts", "try {\n  throw new Error(\"x\");\n} catch (e) {\n  // expect: no-ex-assign error\n  e = \"boom\";\n  console.log(e);\n}\n")
}
