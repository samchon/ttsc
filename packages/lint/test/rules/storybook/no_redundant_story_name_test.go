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
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase checks storybook/no-redundant-story-name: Primary redundantly sets name Primary; exact rule/severity/line comparison detects extra or missing findings.
// @evidence contracts/testing.md#independent-expectations A distinct custom display name differs from the derived export name. The source annotation marks the independently authored violating construct; the accepted source changes that policy condition instead of deriving expectations from engine output.
// @evidence contracts/testing.md#distinguishing-cases The original violation remains intact and an adjacent zero-finding control exercises this accepted condition: A distinct custom display name differs from the derived export name.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusStorybookNoRedundantStoryName is a named Go unit entry running virtual CSF syntax through the actual shared engine process; it does not install Storybook or launch a renderer.
func TestRuleCorpusStorybookNoRedundantStoryName(t *testing.T) {
  assertRuleCorpusCase(t, "storybook/no-redundant-story-name.ts", "export default { component: Button };\nexport const Primary = {\n  // expect: storybook/no-redundant-story-name warn\n  name: \"Primary\",\n};\n")
  assertRuleSkipsSource(t, "storybook/no-redundant-story-name", "export default { component: Button }; export const Primary = { name: \"Custom display\" };\n")
}
