package linthost

import "testing"

// TestRuleCorpusStorybookNoTitlePropertyInMeta verifies the lint rule corpus fixture storybook/no-title-property-in-meta.
//
// CSF strict mode derives titles from file placement and project config. This pins the default meta scan branch that
// reports an explicit title property while leaving the rest of the meta object intact.
//
// 1. Load a default meta object with a title and component.
// 2. Enable storybook/no-title-property-in-meta from the annotation.
// 3. Assert the title property is reported.
func TestRuleCorpusStorybookNoTitlePropertyInMeta(t *testing.T) {
  assertRuleCorpusCase(t, "storybook/no-title-property-in-meta.ts", "export default {\n  // expect: storybook/no-title-property-in-meta error\n  title: \"Atoms/Button\",\n  component: Button,\n};\nexport const Primary = {};\n")
}
