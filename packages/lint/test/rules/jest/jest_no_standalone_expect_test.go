package linthost

import "testing"

// TestRuleCorpusJestNoStandaloneExpect verifies the lint rule corpus fixture jest/no-standalone-expect.ts.
//
// Expectations directly inside describe blocks execute during suite definition
// instead of as tests. This pins the callback-owner check that distinguishes
// describe callbacks from test callbacks.
//
// 1. Load a describe callback with a direct expect call.
// 2. Enable jest/no-standalone-expect from the annotated expect comment.
// 3. Assert the standalone expect call is reported.
func TestRuleCorpusJestNoStandaloneExpect(t *testing.T) {
  assertRuleCorpusCase(t, "jest-no-standalone-expect.ts", `import { describe, expect } from "@jest/globals";

describe("suite", () => {
  // expect: jest/no-standalone-expect error
  expect(1).toBe(1);
});
`)
}
