package linthost

import "testing"

// TestRuleCorpusJestValidTitle verifies the lint rule corpus fixture
// jest/valid-title.ts.
//
// Empty titles make test reports hard to understand. This pins title extraction
// for test-like calls.
//
// 1. Load a Jest test with an empty title.
// 2. Enable jest/valid-title from the annotated expect comment.
// 3. Assert the test call is reported.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase exercises the actual engine and verifies an empty test title is reported for jest/valid-title; complete rule/severity/line comparison rejects missing or additional findings.
// @evidence contracts/testing.md#independent-expectations A nonempty string is required to identify the test result. The source annotation states that policy independently; the expected result is not a snapshot of rule output.
// @evidence contracts/testing.md#distinguishing-cases The adjacent nonempty title is accepted. Both the original marked violation and the separately authored zero-finding control execute.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusJestValidTitle is a named Go unit entry exercising parsed Jest-shaped TypeScript in the shared owning-engine process; no installed Jest runtime or product child host is needed.
func TestRuleCorpusJestValidTitle(t *testing.T) {
  assertRuleCorpusCase(t, "jest-valid-title.ts", `import { test, expect } from "@jest/globals";

// expect: jest/valid-title error
test("", () => {
  expect(1).toBe(1);
});
`)
  assertRuleSkipsSource(t, "jest/valid-title", "import { test } from \"@jest/globals\"; test(\"named\", () => {});\n")
}
