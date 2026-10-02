package linthost

import "testing"

// TestFixPreferTemplateRewritesLeadingIdentifierChain verifies the
// leading-identifier shape `a + "b"` → “ `${"" + (a)}b` “.
//
// The placeholder must appear as the FIRST template segment, which is
// a distinct emit branch from the trailing-identifier case — the
// rewriter has to inject the opening backtick before the first
// `${"" + (...)}` rather than after a literal prefix.
//
// 1. Snapshot a chain whose leftmost operand is an identifier.
// 2. Apply `prefer-template` fix.
// 3. Assert the placeholder lands at the start of the template.
//
// @evidence contracts/testing.md#behavioral-verification Fixes identifier plus string as an identifier slot followed by literal text.
// Every dynamic slot explicitly retains default-hint concatenation coercion.
//
// @evidence contracts/testing.md#independent-expectations The authored ${"" + (a)}b output preserves conversion of a before the suffix; declarations and following stringify remain byte-identical.
// @evidence contracts/testing.md#distinguishing-cases Minimal two-operand identifier-leading boundary complements the three-part and numeric-subchain tests.
// @evidence contracts/testing.md#execution-ownership assertFixSnapshot calls runFixSnapshot, applies the rule's actual edits to the fixture and compares complete independently authored output. This Test entry owns this exact source/output pair. All execute in the lint Go process without installing consumers or building/launching a native product host.
func TestFixPreferTemplateRewritesLeadingIdentifierChain(t *testing.T) {
  assertFixSnapshot(
    t,
    "prefer-template",
    "const a: any = 1;\nconst s = a + \"b\";\nJSON.stringify(s);\n",
    "const a: any = 1;\nconst s = `${\"\" + (a)}b`;\nJSON.stringify(s);\n",
  )
}
