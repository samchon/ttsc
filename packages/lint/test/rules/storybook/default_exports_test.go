package linthost

import "testing"

// TestRuleCorpusStorybookDefaultExports verifies the lint rule corpus fixture storybook/default-exports.
//
// CSF stories need default metadata even when they have named story exports. This locks the file-level fallback that
// reports the first non-import statement when no default export is present.
//
// 1. Load a story file with a named story export but no default export.
// 2. Enable storybook/default-exports from the annotation.
// 3. Assert the missing default export diagnostic lands on the story export.
func TestRuleCorpusStorybookDefaultExports(t *testing.T) {
  assertRuleCorpusCase(t, "storybook/default-exports.ts", "// expect: storybook/default-exports error\nexport const Primary = {};\n")
}
