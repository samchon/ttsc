package linthost

import "testing"

// TestRuleCorpusStorybookNoRendererPackages verifies the lint rule corpus fixture storybook/no-renderer-packages.
//
// Storybook 8+ expects framework packages rather than direct renderer packages in story source. This pins the import
// declaration path for the React renderer package.
//
// 1. Load a story file importing from @storybook/react.
// 2. Enable storybook/no-renderer-packages from the annotation.
// 3. Assert the renderer import is reported.
func TestRuleCorpusStorybookNoRendererPackages(t *testing.T) {
  assertRuleCorpusCase(t, "storybook/no-renderer-packages.ts", "// expect: storybook/no-renderer-packages error\nimport type { Meta } from \"@storybook/react\";\nexport default { component: Button };\nexport const Primary = {};\n")
}
