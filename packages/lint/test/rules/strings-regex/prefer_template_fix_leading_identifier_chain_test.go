package linthost

import "testing"

// TestFixPreferTemplateRewritesLeadingIdentifierChain verifies the
// leading-identifier shape `a + "b"` → `` `${a}b` ``.
//
// The placeholder must appear as the FIRST template segment, which is
// a distinct emit branch from the trailing-identifier case — the
// rewriter has to inject the opening backtick before the first
// `${...}` rather than after a literal prefix.
//
// 1. Snapshot a chain whose leftmost operand is an identifier.
// 2. Apply `prefer-template` fix.
// 3. Assert the placeholder lands at the start of the template.
func TestFixPreferTemplateRewritesLeadingIdentifierChain(t *testing.T) {
	assertFixSnapshot(
		t,
		"prefer-template",
		"const a: any = 1;\nconst s = a + \"b\";\nJSON.stringify(s);\n",
		"const a: any = 1;\nconst s = `${a}b`;\nJSON.stringify(s);\n",
	)
}
