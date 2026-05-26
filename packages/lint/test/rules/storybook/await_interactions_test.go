package linthost

import "testing"

// TestRuleCorpusStorybookAwaitInteractions verifies the lint rule corpus fixture storybook/await-interactions.
//
// Storybook play functions are async interaction scripts; a bare Testing Library or userEvent call can race the
// assertion that follows it. This pins the file-level Storybook interaction scan instead of relying on a per-call
// rule that cannot see imported story context.
//
// 1. Load a CSF story whose play function calls userEvent without await.
// 2. Enable only storybook/await-interactions from the fixture annotation.
// 3. Assert the native Engine reports the unawaited interaction call.
func TestRuleCorpusStorybookAwaitInteractions(t *testing.T) {
  assertRuleCorpusCase(t, "storybook/await-interactions.ts", "export default { component: Button };\nexport const Primary = {\n  play: async () => {\n    // expect: storybook/await-interactions error\n    userEvent.click(button);\n  },\n};\n")
}
