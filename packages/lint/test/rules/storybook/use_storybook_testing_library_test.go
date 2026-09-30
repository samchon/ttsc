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
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase checks storybook/use-storybook-testing-library: screen is imported from @testing-library/react; exact rule/severity/line comparison detects extra or missing findings.
// @evidence contracts/testing.md#independent-expectations Storybook helper imports preserve its supported interaction integration. The source annotation marks the independently authored violating construct; the accepted source changes that policy condition instead of deriving expectations from engine output.
// @evidence contracts/testing.md#distinguishing-cases The original violation remains intact and an adjacent zero-finding control exercises this accepted condition: Storybook helper imports preserve its supported interaction integration.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusStorybookUseStorybookTestingLibrary is a named Go unit entry running virtual CSF syntax through the actual shared engine process; it does not install Storybook or launch a renderer.
func TestRuleCorpusStorybookUseStorybookTestingLibrary(t *testing.T) {
  assertRuleCorpusCase(t, "storybook/use-storybook-testing-library.ts", "// expect: storybook/use-storybook-testing-library error\nimport { screen } from \"@testing-library/react\";\nexport default { component: Button };\nexport const Primary = {};\nvoid screen;\n")
  assertRuleSkipsSource(t, "storybook/use-storybook-testing-library", "import { screen } from \"@storybook/testing-library\"; export default { component: Button }; export const Primary = {}; void screen;\n")
}
