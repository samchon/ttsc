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
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase checks storybook/no-renderer-packages: a type import uses @storybook/react; exact rule/severity/line comparison detects extra or missing findings.
// @evidence contracts/testing.md#independent-expectations A framework package is the supported integration layer. The source annotation marks the independently authored violating construct; the accepted source changes that policy condition instead of deriving expectations from engine output.
// @evidence contracts/testing.md#distinguishing-cases The original violation remains intact and an adjacent zero-finding control exercises this accepted condition: A framework package is the supported integration layer.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusStorybookNoRendererPackages is a named Go unit entry running virtual CSF syntax through the actual shared engine process; it does not install Storybook or launch a renderer.
func TestRuleCorpusStorybookNoRendererPackages(t *testing.T) {
  assertRuleCorpusCase(t, "storybook/no-renderer-packages.ts", "// expect: storybook/no-renderer-packages error\nimport type { Meta } from \"@storybook/react\";\nexport default { component: Button };\nexport const Primary = {};\n")
  assertRuleSkipsSource(t, "storybook/no-renderer-packages", "import type { Meta } from \"@storybook/react-vite\"; export default { component: Button }; export const Primary = {};\n")
}
