package linthost

import "testing"

// TestRuleCorpusStorybookNoStoriesOf verifies the lint rule corpus fixture storybook/no-stories-of.
//
// The legacy storiesOf API bypasses modern CSF metadata. This locks the named import branch so a file is reported
// before any call-chain-specific analysis is needed.
//
// 1. Load a story file importing storiesOf from a Storybook framework package.
// 2. Enable storybook/no-stories-of from the annotation.
// 3. Assert the import specifier is reported.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase checks storybook/no-stories-of: the import requests storiesOf; exact rule/severity/line comparison detects extra or missing findings.
// @evidence contracts/testing.md#independent-expectations CSF avoids the legacy storiesOf API. The source annotation marks the independently authored violating construct; the accepted source changes that policy condition instead of deriving expectations from engine output.
// @evidence contracts/testing.md#distinguishing-cases The original violation remains intact and an adjacent zero-finding control exercises this accepted condition: CSF avoids the legacy storiesOf API.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusStorybookNoStoriesOf is a named Go unit entry running virtual CSF syntax through the actual shared engine process; it does not install Storybook or launch a renderer.
func TestRuleCorpusStorybookNoStoriesOf(t *testing.T) {
  assertRuleCorpusCase(t, "storybook/no-stories-of.ts", "import {\n  // expect: storybook/no-stories-of error\n  storiesOf,\n} from \"@storybook/react\";\nstoriesOf(\"Atoms/Button\", module);\n")
  assertRuleSkipsSource(t, "storybook/no-stories-of", "export default { component: Button }; export const Primary = {};\n")
}
