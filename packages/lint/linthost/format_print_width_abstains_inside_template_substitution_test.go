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
//
// @evidence contracts/testing.md#behavioral-verification The rule must leave the over-budget encodeURIComponent call inside the template substitution untouched, while the same call as an ordinary statement at width 20 must break and preserve the callee and value argument.
// @evidence contracts/testing.md#independent-expectations Installed Prettier 3.8.3 independently retains the literal template at width 20 and breaks the ordinary call into the authored lines. The template contents /x/ and interpolation value are fixed input meaning, not expectations derived from the ancestor helper.
// @evidence contracts/testing.md#distinguishing-cases The original template negative and ordinary-call positive differ by template ancestry, preventing an always-silent rule from satisfying this host. Existing multiline input behavior is owned by separate multiline and fixed-point tests; this host concerns an originally flat substitution.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthAbstainsInsideTemplateSubstitution owns both literal cases through same-process registered-rule helpers and observes zero findings or complete rewritten source respectively. No installed consumer, native build or real host process is invoked.
func TestFormatPrintWidthAbstainsInsideTemplateSubstitution(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/print-width",
    "const u = `/x/${encodeURIComponent(value)}`;\n",
    `{"printWidth": 20}`,
  )
  assertFixSnapshotWithOptions(t, "format/print-width", "encodeURIComponent(value);\n", `{"printWidth": 20}`, "encodeURIComponent(\n  value,\n);\n")
}
