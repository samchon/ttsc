package linthost

import "testing"

// TestRuleCorpusJestNoDuplicateHooks verifies the lint rule corpus fixture
// jest/no-duplicate-hooks.ts.
//
// Duplicate lifecycle hooks in the same suite obscure setup order. This pins
// the per-suite hook de-duplication map.
//
// 1. Load a suite with two beforeEach hooks.
// 2. Enable jest/no-duplicate-hooks from the annotated expect comment.
// 3. Assert the second hook is reported.
func TestRuleCorpusJestNoDuplicateHooks(t *testing.T) {
  assertRuleCorpusCase(t, "jest-no-duplicate-hooks.ts", `import { describe, beforeEach } from "@jest/globals";

describe("suite", () => {
  beforeEach(() => {});
  // expect: jest/no-duplicate-hooks error
  beforeEach(() => {});
});
`)
}
