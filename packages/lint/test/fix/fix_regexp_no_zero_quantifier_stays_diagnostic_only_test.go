package linthost

import "testing"

// TestFixRegexpNoZeroQuantifierStaysDiagnosticOnly verifies
// `regexp/no-zero-quantifier` reports without offering an edit, deliberately,
// while the rest of the quantifier family now rewrites.
//
// `{0}` is a bug rather than a redundancy: it says the atom never matches, so
// the correction is to delete the atom or repair the bound, and which one is
// meant is not recoverable from the source. Deleting only the braces would turn
// "never" into "once" — the loudest possible wrong rewrite — and this case
// exists so a later pass cannot add that edit by symmetry with its siblings.
//
//  1. Assert `/a{0}/` and `/a{0,0}/` both report.
//  2. Assert neither applies any edit.
//  3. Assert `/a{0,1}/`, one step away on the upper bound, does not report.
func TestFixRegexpNoZeroQuantifierStaysDiagnosticOnly(t *testing.T) {
  assertNoFixSnapshot(
    t,
    "regexp/no-zero-quantifier",
    "const value = /a{0}/;\nJSON.stringify(value);\n",
  )
  assertNoFixSnapshot(
    t,
    "regexp/no-zero-quantifier",
    "const value = /a{0,0}/;\nJSON.stringify(value);\n",
  )
  assertRuleSkipsSource(
    t,
    "regexp/no-zero-quantifier",
    "const value = /a{0,1}/;\nJSON.stringify(value);\n",
  )
}
