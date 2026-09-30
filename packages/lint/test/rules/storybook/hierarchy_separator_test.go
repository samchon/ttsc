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
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase checks storybook/hierarchy-separator: metadata title uses the pipe hierarchy separator; exact rule/severity/line comparison detects extra or missing findings.
// @evidence contracts/testing.md#independent-expectations Slash is the supported hierarchy separator. The source annotation marks the independently authored violating construct; the accepted source changes that policy condition instead of deriving expectations from engine output.
// @evidence contracts/testing.md#distinguishing-cases The original violation remains intact and an adjacent zero-finding control exercises this accepted condition: Slash is the supported hierarchy separator.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusStorybookHierarchySeparator is a named Go unit entry running virtual CSF syntax through the actual shared engine process; it does not install Storybook or launch a renderer.
func TestRuleCorpusStorybookHierarchySeparator(t *testing.T) {
  assertRuleCorpusCase(t, "storybook/hierarchy-separator.ts", "export default {\n  // expect: storybook/hierarchy-separator warn\n  title: \"Atoms|Button\",\n  component: Button,\n};\nexport const Primary = {};\n")
  assertRuleSkipsSource(t, "storybook/hierarchy-separator", "export default { title: \"Atoms/Button\", component: Button }; export const Primary = {};\n")
}
