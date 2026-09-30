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
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase checks storybook/default-exports: a named story has no default metadata; exact rule/severity/line comparison detects extra or missing findings.
// @evidence contracts/testing.md#independent-expectations A default metadata object establishes CSF module metadata. The source annotation marks the independently authored violating construct; the accepted source changes that policy condition instead of deriving expectations from engine output.
// @evidence contracts/testing.md#distinguishing-cases The original violation remains intact and an adjacent zero-finding control exercises this accepted condition: A default metadata object establishes CSF module metadata.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusStorybookDefaultExports is a named Go unit entry running virtual CSF syntax through the actual shared engine process; it does not install Storybook or launch a renderer.
func TestRuleCorpusStorybookDefaultExports(t *testing.T) {
  assertRuleCorpusCase(t, "storybook/default-exports.ts", "// expect: storybook/default-exports error\nexport const Primary = {};\n")
  assertRuleSkipsSource(t, "storybook/default-exports", "export default { component: Button }; export const Primary = {};\n")
}
