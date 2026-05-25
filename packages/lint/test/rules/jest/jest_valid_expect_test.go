package linthost

import "testing"

// TestRuleCorpusJestValidExpect verifies the lint rule corpus fixture jest/valid-expect.ts.
//
// Bare `expect(value)` calls evaluate but assert nothing. This pins the matcher
// chain validation after an expect call has the correct single argument shape.
//
// 1. Load a Jest test with a bare expect call.
// 2. Enable jest/valid-expect from the annotated expect comment.
// 3. Assert the invalid expect usage is reported.
func TestRuleCorpusJestValidExpect(t *testing.T) {
  assertRuleCorpusCase(t, "jest-valid-expect.ts", `import { test, expect } from "@jest/globals";

test("checks value", () => {
  // expect: jest/valid-expect error
  expect(1);
});
`)
}
