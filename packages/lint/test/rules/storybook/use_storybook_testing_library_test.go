package linthost

import "testing"

// TestRuleCorpusStorybookUseStorybookTestingLibrary verifies the lint rule corpus fixture storybook/use-storybook-testing-library.
//
// Interaction tests should import Testing Library helpers through Storybook so the test runtime remains consistent.
// This locks the import declaration path for direct @testing-library usage.
//
// 1. Load a story file importing screen from @testing-library/react.
// 2. Enable storybook/use-storybook-testing-library from the annotation.
// 3. Assert the direct Testing Library import is reported.
func TestRuleCorpusStorybookUseStorybookTestingLibrary(t *testing.T) {
  assertRuleCorpusCase(t, "storybook/use-storybook-testing-library.ts", "// expect: storybook/use-storybook-testing-library error\nimport { screen } from \"@testing-library/react\";\nexport default { component: Button };\nexport const Primary = {};\nvoid screen;\n")
}
