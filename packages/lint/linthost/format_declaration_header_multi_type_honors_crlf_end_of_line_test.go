package linthost

import "testing"

// TestFormatDeclarationHeaderMultiTypeHonorsCRLFEndOfLine verifies the
// single-clause multi-type explode reflow synthesizes CRLF breaks under
// endOfLine:"crlf".
//
// Regression shield for issue #616 on the multiTypeHeader builder: it emitted
// a literal "\n" per exploded type, injecting lone LFs into a CRLF file. Bound
// to the CRLF oracle (LF twin: format_declaration_header_breaks_multi_type_
// interface_test.go); the helper asserts zero lone LFs.
//
//  1. Parse a CRLF interface whose extends list overflows width 50.
//  2. Apply format/declaration-header with {"endOfLine":"crlf"}.
//  3. Assert the keyword and each type break with "\r\n" and no lone LF remains.
//
// @evidence contracts/testing.md#behavioral-verification format/declaration-header must explode the six-type extends clause with CRLF separators and retain the number-typed member.
// @evidence contracts/testing.md#independent-expectations The independently authored full CRLF output preserves the heritage order and annotation; the extra lone-LF rejection verifies consistency beyond visual layout.
// @evidence contracts/testing.md#distinguishing-cases This changed CRLF multi-type interface complements the LF six-type positive and first-tier inline-types layout, covering keyword and each list-element break.
// @evidence contracts/testing.md#execution-ownership TestFormatDeclarationHeaderMultiTypeHonorsCRLFEndOfLine is selected by the lint semantic-unit Evidence claim as a public Go unit. The shared syntax-only harness calls the owning declaration-header rule on temporary fixture source and applies reported edits for the literal output assertion without consumer installation, native product build or a host process.
func TestFormatDeclarationHeaderMultiTypeHonorsCRLFEndOfLine(t *testing.T) {
  assertFixCRLFConsistentWithOptions(
    t,
    "format/declaration-header",
    "interface B extends First, Second, Third, Fourth, Fifth, Sixth {\r\n  a: number;\r\n}\r\n",
    `{"printWidth":50,"tabWidth":2,"endOfLine":"crlf"}`,
    "interface B\r\n  extends\r\n    First,\r\n    Second,\r\n    Third,\r\n    Fourth,\r\n    Fifth,\r\n    Sixth {\r\n  a: number;\r\n}\r\n",
  )
}
