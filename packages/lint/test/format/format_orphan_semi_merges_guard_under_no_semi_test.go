package linthost

import "testing"

// TestFormatOrphanSemiMergesGuardUnderNoSemi verifies that under
// semi:false a lone leading-semicolon ASI guard is pulled onto the
// statement it protects.
//
// Prettier writes `;(expr)` rather than a standalone `;` line before a
// `(`-leading statement. The rule deletes only the whitespace gap, so
// the guard keeps its indent and the statement follows on the same line.
//
//  1. Parse a semi:false guard: a `;` line before a `(`-leading statement.
//  2. Apply format/orphan-semi with semi:false.
//  3. Assert the `;` merges onto the statement line.
func TestFormatOrphanSemiMergesGuardUnderNoSemi(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/orphan-semi",
    "foo()\n;\n(bar as Baz).qux()\n",
    `{"semi":false}`,
    "foo()\n;(bar as Baz).qux()\n",
  )
}
