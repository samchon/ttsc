package linthost

import "testing"

// TestRuleCorpusStorybookPreferPascalCase verifies the lint rule corpus fixture storybook/prefer-pascal-case.
//
// Storybook names stories from their exported identifiers, so lowercase names leak into the UI and URL fragments.
// This pins the named export scan while a valid default meta is present.
//
// 1. Load a CSF file with a default meta object.
// 2. Export a lowercase story variable.
// 3. Assert storybook/prefer-pascal-case reports the story identifier.
func TestRuleCorpusStorybookPreferPascalCase(t *testing.T) {
  assertRuleCorpusCase(t, "storybook/prefer-pascal-case.ts", "export default { component: Button };\n// expect: storybook/prefer-pascal-case warn\nexport const primary = {};\n")
}
