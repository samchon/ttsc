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
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase checks storybook/meta-inline-properties: title comes from a shorthand variable; exact rule/severity/line comparison detects extra or missing findings.
// @evidence contracts/testing.md#independent-expectations An inline literal title is statically readable. The source annotation marks the independently authored violating construct; the accepted source changes that policy condition instead of deriving expectations from engine output.
// @evidence contracts/testing.md#distinguishing-cases The original violation remains intact and an adjacent zero-finding control exercises this accepted condition: An inline literal title is statically readable.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusStorybookMetaInlineProperties is a named Go unit entry running virtual CSF syntax through the actual shared engine process; it does not install Storybook or launch a renderer.
func TestRuleCorpusStorybookMetaInlineProperties(t *testing.T) {
  assertRuleCorpusCase(t, "storybook/meta-inline-properties.ts", "const title = \"Atoms/Button\";\nexport default {\n  // expect: storybook/meta-inline-properties error\n  title,\n  component: Button,\n};\nexport const Primary = {};\n")
  assertRuleSkipsSource(t, "storybook/meta-inline-properties", "export default { title: \"Atoms/Button\", component: Button }; export const Primary = {};\n")
}
