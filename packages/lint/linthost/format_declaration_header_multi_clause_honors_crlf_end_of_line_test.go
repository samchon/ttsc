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
//
// @evidence contracts/testing.md#behavioral-verification format/declaration-header must break extends, implements and the class brace with CRLF while retaining Base, four implemented types and a=1.
// @evidence contracts/testing.md#independent-expectations The full literal expected source and explicit crlf option independently determine exact separators; the additional no-lone-LF check rejects mixed output.
// @evidence contracts/testing.md#distinguishing-cases This changed CRLF multi-clause class is the separator counterpart to the LF positive and canonical broken-clause no-op, exercising every synthesized clause/brace break.
// @evidence contracts/testing.md#execution-ownership TestFormatDeclarationHeaderMultiClauseHonorsCRLFEndOfLine is selected by the lint semantic-unit Evidence claim as a public Go unit. The shared syntax-only harness calls the owning declaration-header rule on temporary fixture source and applies reported edits for the literal output assertion without consumer installation, native product build or a host process.
func TestFormatDeclarationHeaderMultiClauseHonorsCRLFEndOfLine(t *testing.T) {
  assertFixCRLFConsistentWithOptions(
    t,
    "format/declaration-header",
    "class C extends Base implements First, Second, Third, Fourth {\r\n  a = 1;\r\n}\r\n",
    `{"printWidth":50,"tabWidth":2,"endOfLine":"crlf"}`,
    "class C\r\n  extends Base\r\n  implements First, Second, Third, Fourth\r\n{\r\n  a = 1;\r\n}\r\n",
  )
}
