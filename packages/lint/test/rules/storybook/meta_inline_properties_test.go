package linthost

import "testing"

// TestRuleCorpusStorybookMetaInlineProperties verifies the lint rule corpus fixture storybook/meta-inline-properties.
//
// Some Storybook metadata must remain statically readable from the meta object. This covers the dynamic title branch
// where a variable reference hides the value from static CSF analysis.
//
// 1. Define the title in a variable outside the meta object.
// 2. Use that variable as the default meta title.
// 3. Assert storybook/meta-inline-properties reports the dynamic property.
func TestRuleCorpusStorybookMetaInlineProperties(t *testing.T) {
  assertRuleCorpusCase(t, "storybook/meta-inline-properties.ts", "const title = \"Atoms/Button\";\nexport default {\n  // expect: storybook/meta-inline-properties error\n  title,\n  component: Button,\n};\nexport const Primary = {};\n")
}
