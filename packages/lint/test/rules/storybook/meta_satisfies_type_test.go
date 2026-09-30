package linthost

import "testing"

// TestRuleCorpusStorybookMetaSatisfiesType verifies the lint rule corpus fixture storybook/meta-satisfies-type.
//
// Storybook's modern TypeScript guidance prefers `satisfies Meta` so meta fields stay checked without widening. This
// pins the direct default-object branch that should complain when no satisfies expression wraps the object.
//
// 1. Load a default meta object with no TypeScript `satisfies` clause.
// 2. Enable storybook/meta-satisfies-type from the annotation.
// 3. Assert the meta object is reported.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase checks storybook/meta-satisfies-type: plain metadata omits satisfies Meta; exact rule/severity/line comparison detects extra or missing findings.
// @evidence contracts/testing.md#independent-expectations The satisfies Meta expression checks metadata without widening it. The source annotation marks the independently authored violating construct; the accepted source changes that policy condition instead of deriving expectations from engine output.
// @evidence contracts/testing.md#distinguishing-cases The original violation remains intact and an adjacent zero-finding control exercises this accepted condition: The satisfies Meta expression checks metadata without widening it.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusStorybookMetaSatisfiesType is a named Go unit entry running virtual CSF syntax through the actual shared engine process; it does not install Storybook or launch a renderer.
func TestRuleCorpusStorybookMetaSatisfiesType(t *testing.T) {
  assertRuleCorpusCase(t, "storybook/meta-satisfies-type.ts", "// expect: storybook/meta-satisfies-type error\nexport default { component: Button };\nexport const Primary = {};\n")
  assertRuleSkipsSource(t, "storybook/meta-satisfies-type", "export default { component: Button } satisfies Meta; export const Primary = {};\n")
}
