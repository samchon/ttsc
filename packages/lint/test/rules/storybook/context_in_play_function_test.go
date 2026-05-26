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
func TestRuleCorpusStorybookContextInPlayFunction(t *testing.T) {
  assertRuleCorpusCase(t, "storybook/context-in-play-function.ts", "export default { component: Button };\nexport const Primary = {};\nexport const Secondary = {\n  play: async (context) => {\n    // expect: storybook/context-in-play-function error\n    Primary.play();\n  },\n};\n")
}
