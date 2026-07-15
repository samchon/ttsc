package linthost

import "testing"

// TestFormatDeclarationHeaderMultiClauseHonorsCRLFEndOfLine verifies the
// multi-clause header reflow synthesizes CRLF breaks under endOfLine:"crlf".
//
// Regression shield for issue #616: the reflow builder hard-coded "\n", so a
// broken class header on an otherwise-CRLF file gained lone LFs and persisted
// mixed line endings. Bound to the CRLF oracle (the LF twin lives in
// format_declaration_header_breaks_multiple_clauses_test.go), and the helper
// additionally asserts every "\n" belongs to a "\r\n".
//
//  1. Parse a CRLF class whose extends+implements header overflows width 50.
//  2. Apply format/declaration-header with {"endOfLine":"crlf"}.
//  3. Assert each synthesized break is "\r\n" and no lone LF remains.
func TestFormatDeclarationHeaderMultiClauseHonorsCRLFEndOfLine(t *testing.T) {
  assertFixCRLFConsistentWithOptions(
    t,
    "format/declaration-header",
    "class C extends Base implements First, Second, Third, Fourth {\r\n  a = 1;\r\n}\r\n",
    `{"printWidth":50,"tabWidth":2,"endOfLine":"crlf"}`,
    "class C\r\n  extends Base\r\n  implements First, Second, Third, Fourth\r\n{\r\n  a = 1;\r\n}\r\n",
  )
}
