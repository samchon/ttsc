package linthost

import "testing"

// TestRuleCorpusStorybookCsfComponent verifies the lint rule corpus fixture storybook/csf-component.
//
// CSF meta without a component weakens autodocs and arg inference. This pins the default-export meta object path used
// by the Storybook family before more specific title and story-export rules run.
//
// 1. Load a story file whose default meta has only a title.
// 2. Enable storybook/csf-component from the expectation comment.
// 3. Assert the rule reports the default export.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase checks storybook/csf-component: default metadata omits component; exact rule/severity/line comparison detects extra or missing findings.
// @evidence contracts/testing.md#independent-expectations The component property establishes the CSF component association. The source annotation marks the independently authored violating construct; the accepted source changes that policy condition instead of deriving expectations from engine output.
// @evidence contracts/testing.md#distinguishing-cases The original violation remains intact and an adjacent zero-finding control exercises this accepted condition: The component property establishes the CSF component association.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusStorybookCsfComponent is a named Go unit entry running virtual CSF syntax through the actual shared engine process; it does not install Storybook or launch a renderer.
func TestRuleCorpusStorybookCsfComponent(t *testing.T) {
  assertRuleCorpusCase(t, "storybook/csf-component.ts", "// expect: storybook/csf-component error\nexport default { title: \"Atoms/Button\" };\nexport const Primary = {};\n")
  assertRuleSkipsSource(t, "storybook/csf-component", "export default { title: \"Atoms/Button\", component: Button }; export const Primary = {};\n")
}
