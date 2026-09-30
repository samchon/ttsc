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
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase checks storybook/prefer-pascal-case: the primary story export starts lowercase; exact rule/severity/line comparison detects extra or missing findings.
// @evidence contracts/testing.md#independent-expectations Primary satisfies the story identifier capitalization policy. The source annotation marks the independently authored violating construct; the accepted source changes that policy condition instead of deriving expectations from engine output.
// @evidence contracts/testing.md#distinguishing-cases The original violation remains intact and an adjacent zero-finding control exercises this accepted condition: Primary satisfies the story identifier capitalization policy.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusStorybookPreferPascalCase is a named Go unit entry running virtual CSF syntax through the actual shared engine process; it does not install Storybook or launch a renderer.
func TestRuleCorpusStorybookPreferPascalCase(t *testing.T) {
  assertRuleCorpusCase(t, "storybook/prefer-pascal-case.ts", "export default { component: Button };\n// expect: storybook/prefer-pascal-case warn\nexport const primary = {};\n")
  assertRuleSkipsSource(t, "storybook/prefer-pascal-case", "export default { component: Button }; export const Primary = {};\n")
}
