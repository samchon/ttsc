package linthost

import "testing"

// TestRuleCorpusJestNoHooks verifies the lint rule corpus fixture
// jest/no-hooks.ts.
//
// Some projects require explicit setup inside each test. This pins the direct
// hook-call matcher for that policy.
//
// 1. Load a Jest beforeAll hook.
// 2. Enable jest/no-hooks from the annotated expect comment.
// 3. Assert the hook call is reported.
func TestRuleCorpusJestNoHooks(t *testing.T) {
  assertRuleCorpusCase(t, "jest-no-hooks.ts", `import { beforeAll } from "@jest/globals";

// expect: jest/no-hooks error
beforeAll(() => {});
`)
}
