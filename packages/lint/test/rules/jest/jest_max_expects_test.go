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
}
