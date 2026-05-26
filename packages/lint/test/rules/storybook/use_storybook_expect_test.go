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
func TestRuleCorpusStorybookUseStorybookExpect(t *testing.T) {
  assertRuleCorpusCase(t, "storybook/use-storybook-expect.ts", "export default { component: Button };\nexport const Primary = {\n  play: () => {\n    // expect: storybook/use-storybook-expect error\n    expect(button).toBeVisible();\n  },\n};\n")
}
