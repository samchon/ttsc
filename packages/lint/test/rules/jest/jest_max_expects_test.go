package linthost

import "testing"

// TestRuleCorpusJestMaxExpects verifies the lint rule corpus fixture
// jest/max-expects.ts.
//
// Assertion-heavy tests are hard to diagnose when they fail. This pins the
// per-test assertion counter and its current limit.
//
// 1. Load a Jest test containing six assertions.
// 2. Enable jest/max-expects from the annotated expect comment.
// 3. Assert the over-budget test call is reported.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase exercises the actual engine and verifies a callback with six assertions is reported for jest/max-expects; complete rule/severity/line comparison rejects missing or additional findings.
// @evidence contracts/testing.md#independent-expectations The supported default assertion budget is five. The source annotation states that policy independently; the expected result is not a snapshot of rule output.
// @evidence contracts/testing.md#distinguishing-cases Exactly five assertions exercise the accepted limit. Both the original marked violation and the separately authored zero-finding control execute.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusJestMaxExpects is a named Go unit entry exercising parsed Jest-shaped TypeScript in the shared owning-engine process; no installed Jest runtime or product child host is needed.
func TestRuleCorpusJestMaxExpects(t *testing.T) {
  assertRuleCorpusCase(t, "jest-max-expects.ts", `import { test, expect } from "@jest/globals";

// expect: jest/max-expects error
test("checks many values", () => {
  expect(1).toBe(1);
  expect(2).toBe(2);
  expect(3).toBe(3);
  expect(4).toBe(4);
  expect(5).toBe(5);
  expect(6).toBe(6);
});
`)
  assertRuleSkipsSource(t, "jest/max-expects", "import { test, expect } from \"@jest/globals\"; test(\"five\", () => { expect(1).toBe(1); expect(2).toBe(2); expect(3).toBe(3); expect(4).toBe(4); expect(5).toBe(5); });\n")
}
