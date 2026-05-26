package linthost

import "testing"

// TestRuleCorpusStorybookNoRedundantStoryName verifies the lint rule corpus fixture storybook/no-redundant-story-name.
//
// CSF derives display names from named exports, so repeating the derived name is noisy metadata. This locks the CSF3
// object-story path where the redundant name lives inside the exported object literal.
//
// 1. Load a PascalCase story export with a matching `name` property.
// 2. Enable storybook/no-redundant-story-name from the annotation.
// 3. Assert the redundant property is reported.
func TestRuleCorpusStorybookNoRedundantStoryName(t *testing.T) {
  assertRuleCorpusCase(t, "storybook/no-redundant-story-name.ts", "export default { component: Button };\nexport const Primary = {\n  // expect: storybook/no-redundant-story-name warn\n  name: \"Primary\",\n};\n")
}
