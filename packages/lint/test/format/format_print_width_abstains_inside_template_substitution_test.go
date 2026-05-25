package linthost

import "testing"

// TestFormatPrintWidthAbstainsInsideTemplateSubstitution verifies the
// rule leaves a call expression nested in a template-literal `${…}`
// substitution byte-identical, never reflowing it across lines.
//
// Prettier renders template interpolations at printWidth:Infinity — it
// only keeps a line break the source already had — so breaking a call
// inside `${…}` would split the template and diverge from Prettier.
// hasTemplateSubstitutionAncestor makes the rule abstain even when the
// substitution's call would otherwise overflow the budget.
//
//  1. Configure printWidth=20 — the `${…}` call exceeds it.
//  2. Feed a template literal whose substitution holds a call.
//  3. Assert the rule reports nothing, leaving the template intact.
func TestFormatPrintWidthAbstainsInsideTemplateSubstitution(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "formatPrintWidth",
    "const u = `/x/${encodeURIComponent(value)}`;\n",
    `{"printWidth": 20}`,
  )
}
