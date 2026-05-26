package linthost

import "testing"

// TestRuleCorpusStorybookHierarchySeparator verifies the lint rule corpus fixture storybook/hierarchy-separator.
//
// Storybook deprecated `|` in titles in favor of slash hierarchy segments. This pins detection on the default meta
// title property without involving any formatter rewrite path.
//
// 1. Load a default meta object whose title contains a pipe separator.
// 2. Enable storybook/hierarchy-separator from the annotation.
// 3. Assert the title property is reported.
func TestRuleCorpusStorybookHierarchySeparator(t *testing.T) {
  assertRuleCorpusCase(t, "storybook/hierarchy-separator.ts", "export default {\n  // expect: storybook/hierarchy-separator warn\n  title: \"Atoms|Button\",\n  component: Button,\n};\nexport const Primary = {};\n")
}
