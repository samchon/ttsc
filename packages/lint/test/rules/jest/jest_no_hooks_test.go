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
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase exercises the actual engine and verifies beforeAll is reported for jest/no-hooks; complete rule/severity/line comparison rejects missing or additional findings.
// @evidence contracts/testing.md#independent-expectations The configured policy requires test-local setup instead of lifecycle hooks. The source annotation states that policy independently; the expected result is not a snapshot of rule output.
// @evidence contracts/testing.md#distinguishing-cases An ordinary test callback is not a setup hook. Both the original marked violation and the separately authored zero-finding control execute.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusJestNoHooks is a named Go unit entry exercising parsed Jest-shaped TypeScript in the shared owning-engine process; no installed Jest runtime or product child host is needed.
func TestRuleCorpusJestNoHooks(t *testing.T) {
  assertRuleCorpusCase(t, "jest-no-hooks.ts", `import { beforeAll } from "@jest/globals";

// expect: jest/no-hooks error
beforeAll(() => {});
`)
  assertRuleSkipsSource(t, "jest/no-hooks", "import { test } from \"@jest/globals\"; test(\"inline\", () => {});\n")
}
