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
func TestRuleCorpusJestValidTitle(t *testing.T) {
  assertRuleCorpusCase(t, "jest-valid-title.ts", `import { test, expect } from "@jest/globals";

// expect: jest/valid-title error
test("", () => {
  expect(1).toBe(1);
});
`)
}
