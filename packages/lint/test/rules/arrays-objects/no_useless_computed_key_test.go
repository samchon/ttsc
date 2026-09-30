package linthost

import "testing"

// TestRuleCorpusNoUselessComputedKey verifies the lint rule corpus fixture no-useless-computed-key.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// This case enables the rule annotations declared in no-useless-computed-key.ts and compares
// normalized rule, severity, and line triples. The source text stays embedded in the generated
// Go file so the test remains package-local and deterministic.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports the original computed string-literal property while permitting genuinely dynamic keys and ordinary property names.
// @evidence contracts/testing.md#independent-expectations A fixed literal key needs no computation, whereas a variable key uses its value; the authored expectation encodes this semantic distinction independently.
// @evidence contracts/testing.md#distinguishing-cases The computed foo literal reports; [key] and ordinary foo remain clean adjacent forms.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoUselessComputedKey owns every assertion and any named table subcases in the shared Go unit population. Parsed-source Engine operations and direct fix application use disposable fixture files where needed, without a consumer install, native build or product host.
func TestRuleCorpusNoUselessComputedKey(t *testing.T) {
  assertRuleCorpusCase(t, "no-useless-computed-key.ts", "// expect: no-useless-computed-key error\nconst o = { [\"foo\"]: 1 };\nJSON.stringify(o);\n")
  assertRuleSkipsSource(t, "no-useless-computed-key", "const key = \"foo\"; const dynamic = { [key]: 1 }; const ordinary = { foo: 1 };\n")
}
