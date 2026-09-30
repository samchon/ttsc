package linthost

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
//
// @evidence contracts/testing.md#behavioral-verification Engine reports reassignment of the catch parameter and permits reading it while updating an independent local.
// @evidence contracts/testing.md#independent-expectations The catch-binding write prohibition independently identifies e = boom; unrelated locals do not modify that binding.
// @evidence contracts/testing.md#distinguishing-cases Catch parameter assignment reports; its read and a local update stay clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoExAssign is selected in the shared Go unit population. It calls assertRuleCorpusCase with no-ex-assign.ts through the owning Engine and assertRuleSkipsSource for the explicit clean input. No consumer install, native artifact build or real host runs.
func TestRuleCorpusNoExAssign(t *testing.T) {
  assertRuleCorpusCase(t, "no-ex-assign.ts", "try {\n  throw new Error(\"x\");\n} catch (e) {\n  // expect: no-ex-assign error\n  e = \"boom\";\n  console.log(e);\n}\n")
  assertRuleSkipsSource(t, "no-ex-assign", "try { work(); } catch (e) { let local = e; local = \"handled\"; log(e, local); }\n")
}
