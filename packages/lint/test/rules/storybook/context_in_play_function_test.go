package linthost

import "testing"

// TestRuleCorpusStorybookContextInPlayFunction verifies the lint rule corpus fixture storybook/context-in-play-function.
//
// Story composition must pass the active play context through to the composed story. This catches the branch where a
// play function calls another story's play method but omits the context argument entirely.
//
// 1. Load a CSF story with a play function that receives context.
// 2. Call another story's play function without forwarding that context.
// 3. Assert storybook/context-in-play-function reports the call expression.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase checks storybook/context-in-play-function: Primary.play() omits the active context; exact rule/severity/line comparison detects extra or missing findings.
// @evidence contracts/testing.md#independent-expectations Forwarding context preserves composed-story state. The source annotation marks the independently authored violating construct; the accepted source changes that policy condition instead of deriving expectations from engine output.
// @evidence contracts/testing.md#distinguishing-cases The original violation remains intact and an adjacent zero-finding control exercises this accepted condition: Forwarding context preserves composed-story state.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusStorybookContextInPlayFunction is a named Go unit entry running virtual CSF syntax through the actual shared engine process; it does not install Storybook or launch a renderer.
func TestRuleCorpusStorybookContextInPlayFunction(t *testing.T) {
  assertRuleCorpusCase(t, "storybook/context-in-play-function.ts", "export default { component: Button };\nexport const Primary = {};\nexport const Secondary = {\n  play: async (context) => {\n    // expect: storybook/context-in-play-function error\n    Primary.play();\n  },\n};\n")
  assertRuleSkipsSource(t, "storybook/context-in-play-function", "export default { component: Button }; export const Primary = {}; export const Secondary = { play: async context => { await Primary.play(context); } };\n")
}
