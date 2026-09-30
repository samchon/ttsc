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
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase checks storybook/await-interactions: unawaited userEvent.click in play; exact rule/severity/line comparison detects extra or missing findings.
// @evidence contracts/testing.md#independent-expectations Awaiting the interaction finishes it before later assertions. The source annotation marks the independently authored violating construct; the accepted source changes that policy condition instead of deriving expectations from engine output.
// @evidence contracts/testing.md#distinguishing-cases The original violation remains intact and an adjacent zero-finding control exercises this accepted condition: Awaiting the interaction finishes it before later assertions.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusStorybookAwaitInteractions is a named Go unit entry running virtual CSF syntax through the actual shared engine process; it does not install Storybook or launch a renderer.
func TestRuleCorpusStorybookAwaitInteractions(t *testing.T) {
  assertRuleCorpusCase(t, "storybook/await-interactions.ts", "export default { component: Button };\nexport const Primary = {\n  play: async () => {\n    // expect: storybook/await-interactions error\n    userEvent.click(button);\n  },\n};\n")
  assertRuleSkipsSource(t, "storybook/await-interactions", "export default { component: Button }; export const Primary = { play: async () => { await userEvent.click(button); } };\n")
}
