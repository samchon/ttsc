package linthost

import "testing"

// TestRuleCorpusStorybookUseStorybookExpect verifies the lint rule corpus fixture storybook/use-storybook-expect.
//
// Storybook's test runner wires its own expect implementation for interaction assertions. This pins the branch where
// a play function uses a global expect without importing Storybook's expect helper.
//
// 1. Load a CSF story with a play function.
// 2. Call global expect inside the play body.
// 3. Assert storybook/use-storybook-expect reports the expect call.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase checks storybook/use-storybook-expect: play calls global expect; exact rule/severity/line comparison detects extra or missing findings.
// @evidence contracts/testing.md#independent-expectations Importing Storybook expect supplies its interaction assertion runtime. The source annotation marks the independently authored violating construct; the accepted source changes that policy condition instead of deriving expectations from engine output.
// @evidence contracts/testing.md#distinguishing-cases The original violation remains intact and an adjacent zero-finding control exercises this accepted condition: Importing Storybook expect supplies its interaction assertion runtime.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusStorybookUseStorybookExpect is a named Go unit entry running virtual CSF syntax through the actual shared engine process; it does not install Storybook or launch a renderer.
func TestRuleCorpusStorybookUseStorybookExpect(t *testing.T) {
  assertRuleCorpusCase(t, "storybook/use-storybook-expect.ts", "export default { component: Button };\nexport const Primary = {\n  play: () => {\n    // expect: storybook/use-storybook-expect error\n    expect(button).toBeVisible();\n  },\n};\n")
  assertRuleSkipsSource(t, "storybook/use-storybook-expect", "import { expect } from \"@storybook/test\"; export default { component: Button }; export const Primary = { play: () => { expect(button).toBeVisible(); } };\n")
}
