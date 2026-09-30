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
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase checks storybook/no-title-property-in-meta: metadata sets an explicit title; exact rule/severity/line comparison detects extra or missing findings.
// @evidence contracts/testing.md#independent-expectations Omitting title lets configured discovery derive it. The source annotation marks the independently authored violating construct; the accepted source changes that policy condition instead of deriving expectations from engine output.
// @evidence contracts/testing.md#distinguishing-cases The original violation remains intact and an adjacent zero-finding control exercises this accepted condition: Omitting title lets configured discovery derive it.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusStorybookNoTitlePropertyInMeta is a named Go unit entry running virtual CSF syntax through the actual shared engine process; it does not install Storybook or launch a renderer.
func TestRuleCorpusStorybookNoTitlePropertyInMeta(t *testing.T) {
  assertRuleCorpusCase(t, "storybook/no-title-property-in-meta.ts", "export default {\n  // expect: storybook/no-title-property-in-meta error\n  title: \"Atoms/Button\",\n  component: Button,\n};\nexport const Primary = {};\n")
  assertRuleSkipsSource(t, "storybook/no-title-property-in-meta", "export default { component: Button }; export const Primary = {};\n")
}
