package linthost

import "testing"

// TestRuleCorpusJestValidDescribeCallback verifies the lint rule corpus fixture
// jest/valid-describe-callback.ts.
//
// Async describe callbacks are not awaited by Jest. This pins the callback
// validation branch for suite declarations.
//
// 1. Load an async describe callback.
// 2. Enable jest/valid-describe-callback from the annotated expect comment.
// 3. Assert the callback is reported.
func TestRuleCorpusJestValidDescribeCallback(t *testing.T) {
  assertRuleCorpusCase(t, "jest-valid-describe-callback.ts", `import { describe } from "@jest/globals";

describe("suite", 
  // expect: jest/valid-describe-callback error
  async () => {});
`)
}
