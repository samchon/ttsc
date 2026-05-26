package linthost

import "testing"

// TestRuleCorpusJestNoIdenticalTitle verifies the lint rule corpus fixture jest/no-identical-title.ts.
//
// Duplicate sibling titles make Jest failures ambiguous. This pins the
// suite-level title map so only titles at the same describe level collide.
//
// 1. Load one describe block with two tests sharing a title.
// 2. Enable jest/no-identical-title from the annotated expect comment.
// 3. Assert the second duplicate title is reported.
func TestRuleCorpusJestNoIdenticalTitle(t *testing.T) {
  assertRuleCorpusCase(t, "jest-no-identical-title.ts", `import { describe, it, expect } from "@jest/globals";

describe("math", () => {
  it("adds", () => {
    expect(1 + 1).toBe(2);
  });

  // expect: jest/no-identical-title error
  it("adds", () => {
    expect(2 + 2).toBe(4);
  });
});
`)
}
