package linthost

import "testing"

// TestRuleCorpusNoUselessCatch verifies the lint rule corpus fixture no-useless-catch.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-useless-catch.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports a catch that only rethrows and permits a catch that performs handling before rethrow.
// @evidence contracts/testing.md#independent-expectations A catch with no intervening work preserves exactly the thrown exception; an authored log introduces handling independently of findings.
// @evidence contracts/testing.md#distinguishing-cases The original lone rethrow reports; log(e) followed by throw e stays clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoUselessCatch is selected in the shared Go unit population. It calls assertRuleCorpusCase with no-useless-catch.ts through the owning Engine and assertRuleSkipsSource for the explicit clean input. No consumer install, native artifact build or real host runs.
func TestRuleCorpusNoUselessCatch(t *testing.T) {
  assertRuleCorpusCase(t, "no-useless-catch.ts", "function f() {\n  try {\n    return 1;\n    // expect: no-useless-catch error\n  } catch (e) {\n    throw e;\n  }\n}\nJSON.stringify(f);\n")
  assertRuleSkipsSource(t, "no-useless-catch", "try { work(); } catch (e) { log(e); throw e; }\n")
}
