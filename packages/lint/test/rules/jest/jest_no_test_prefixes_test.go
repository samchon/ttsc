package linthost

import "testing"

// TestRuleCorpusJestNoTestPrefixes verifies the lint rule corpus fixture
// jest/no-test-prefixes.ts.
//
// Prefix aliases such as `fit` bypass more explicit `.only`/`.skip` spelling.
// This pins the alias matcher independently from focused/disabled policies.
//
// 1. Load a focused-prefix Jest test.
// 2. Enable jest/no-test-prefixes from the annotated expect comment.
// 3. Assert the prefixed call is reported.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase exercises the actual engine and verifies fit is reported for jest/no-test-prefixes; complete rule/severity/line comparison rejects missing or additional findings.
// @evidence contracts/testing.md#independent-expectations Explicit call modifiers are required instead of focused-prefix aliases. The source annotation states that policy independently; the expected result is not a snapshot of rule output.
// @evidence contracts/testing.md#distinguishing-cases An ordinary it identifier is not a prefixed alias. Both the original marked violation and the separately authored zero-finding control execute.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusJestNoTestPrefixes is a named Go unit entry exercising parsed Jest-shaped TypeScript in the shared owning-engine process; no installed Jest runtime or product child host is needed.
func TestRuleCorpusJestNoTestPrefixes(t *testing.T) {
  assertRuleCorpusCase(t, "jest-no-test-prefixes.ts", `import { fit, expect } from "@jest/globals";

// expect: jest/no-test-prefixes error
fit("focuses", () => {
  expect(1).toBe(1);
});
`)
  assertRuleSkipsSource(t, "jest/no-test-prefixes", "import { it } from \"@jest/globals\"; it(\"ordinary\", () => {});\n")
}
