package linthost

import "testing"

// TestRuleCorpusStorybookStoryExports verifies the lint rule corpus fixture storybook/story-exports.
//
// A CSF file with metadata but no usable named story export is invisible to Storybook. This pins the filter path that
// ignores reserved metadata exports like __namedExportsOrder.
//
// 1. Load a file with default meta and only a reserved named export.
// 2. Enable storybook/story-exports from the annotation.
// 3. Assert the default meta statement is reported as having no stories.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase checks storybook/story-exports: metadata has only the reserved __namedExportsOrder export; exact rule/severity/line comparison detects extra or missing findings.
// @evidence contracts/testing.md#independent-expectations A usable Primary named export supplies an actual story. The source annotation marks the independently authored violating construct; the accepted source changes that policy condition instead of deriving expectations from engine output.
// @evidence contracts/testing.md#distinguishing-cases The original violation remains intact and an adjacent zero-finding control exercises this accepted condition: A usable Primary named export supplies an actual story.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusStorybookStoryExports is a named Go unit entry running virtual CSF syntax through the actual shared engine process; it does not install Storybook or launch a renderer.
func TestRuleCorpusStorybookStoryExports(t *testing.T) {
  assertRuleCorpusCase(t, "storybook/story-exports.ts", "// expect: storybook/story-exports error\nexport default { component: Button };\nexport const __namedExportsOrder = [\"Primary\"];\n")
  assertRuleSkipsSource(t, "storybook/story-exports", "export default { component: Button }; export const __namedExportsOrder = [\"Primary\"]; export const Primary = {};\n")
}
