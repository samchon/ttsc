package linthost

import "testing"

// TestRuleCorpusStorybookStoryExports verifies the lint rule corpus fixture storybook/story-exports.
//
// A CSF file with metadata but no usable named story export is invisible to Storybook. This pins the filter path that
// ignores reserved metadata exports like __namedExportsOrder.
//
// 1. Load a file with default meta and only a reserved named export.
// 2. Enable storybook/story-exports from the annotation.
// 3. Assert the default meta statement is reported as having no stories.
func TestRuleCorpusStorybookStoryExports(t *testing.T) {
  assertRuleCorpusCase(t, "storybook/story-exports.ts", "// expect: storybook/story-exports error\nexport default { component: Button };\nexport const __namedExportsOrder = [\"Primary\"];\n")
}
