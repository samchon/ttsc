package linthost

import "testing"

// TestRuleCorpusStorybookCsfComponent verifies the lint rule corpus fixture storybook/csf-component.
//
// CSF meta without a component weakens autodocs and arg inference. This pins the default-export meta object path used
// by the Storybook family before more specific title and story-export rules run.
//
// 1. Load a story file whose default meta has only a title.
// 2. Enable storybook/csf-component from the expectation comment.
// 3. Assert the rule reports the default export.
func TestRuleCorpusStorybookCsfComponent(t *testing.T) {
  assertRuleCorpusCase(t, "storybook/csf-component.ts", "// expect: storybook/csf-component error\nexport default { title: \"Atoms/Button\" };\nexport const Primary = {};\n")
}
