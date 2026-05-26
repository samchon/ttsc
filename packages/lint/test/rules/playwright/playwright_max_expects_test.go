package linthost

import "testing"

// TestRuleCorpusPlaywrightMaxExpects verifies the lint rule corpus fixture playwright/max-expects.ts.
//
// Assertion-heavy tests are harder to diagnose when they fail. This pins the
// SourceFile-level callback scan that counts expect calls inside a Playwright
// test body.
//
// 1. Load one Playwright test with six assertions.
// 2. Enable playwright/max-expects from the annotated expect comment.
// 3. Assert the test call is reported.
func TestRuleCorpusPlaywrightMaxExpects(t *testing.T) {
  assertRuleCorpusCase(t, "playwright-max-expects.ts", `import { test, expect } from "@playwright/test";

// expect: playwright/max-expects error
test("has many assertions", async () => {
  expect(1).toBe(1);
  expect(2).toBe(2);
  expect(3).toBe(3);
  expect(4).toBe(4);
  expect(5).toBe(5);
  expect(6).toBe(6);
});
`)
}
