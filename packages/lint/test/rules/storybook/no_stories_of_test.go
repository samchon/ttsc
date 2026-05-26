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
func TestRuleCorpusStorybookNoStoriesOf(t *testing.T) {
  assertRuleCorpusCase(t, "storybook/no-stories-of.ts", "import {\n  // expect: storybook/no-stories-of error\n  storiesOf,\n} from \"@storybook/react\";\nstoriesOf(\"Atoms/Button\", module);\n")
}
