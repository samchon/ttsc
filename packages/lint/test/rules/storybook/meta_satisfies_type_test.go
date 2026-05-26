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
func TestRuleCorpusStorybookMetaSatisfiesType(t *testing.T) {
  assertRuleCorpusCase(t, "storybook/meta-satisfies-type.ts", "// expect: storybook/meta-satisfies-type error\nexport default { component: Button };\nexport const Primary = {};\n")
}
