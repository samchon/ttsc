package linthost

import "testing"

// TestFormatDeclarationHeaderTypeParamExplodeHonorsCRLFEndOfLine verifies the
// type-parameter explode reflow (including the break-after-`=` default hang)
// synthesizes CRLF breaks under endOfLine:"crlf".
//
// Regression shield for issue #616 on the typeParamExplodeHeader and
// renderExplodedTypeParam builders: both emitted literal "\n" for the `<`, the
// per-parameter comma, and the default-hang split, injecting lone LFs into a
// CRLF file. Bound to the CRLF oracle (LF twin: format_declaration_header_
// breaks_type_param_default_after_equals_test.go); the helper asserts zero
// lone LFs.
//
//  1. Parse a CRLF class with one long defaulted type parameter (width 50).
//  2. Apply format/declaration-header with {"endOfLine":"crlf"}.
//  3. Assert the list explodes and the default hangs with "\r\n", no lone LF.
//
// @evidence contracts/testing.md#behavioral-verification format/declaration-header must explode a long constrained/defaulted type parameter with CRLF at the angle-list and equals-default breaks while preserving a=1.
// @evidence contracts/testing.md#independent-expectations The full independently authored escaped CRLF output specifies the default hang and trailing comma; the helper additionally rejects every lone LF.
// @evidence contracts/testing.md#distinguishing-cases This changed CRLF defaulted-parameter case complements its LF positive and generic/multi-clause abstention, exercising both list explosion and nested default indentation.
// @evidence contracts/testing.md#execution-ownership TestFormatDeclarationHeaderTypeParamExplodeHonorsCRLFEndOfLine is a public Go unit selected by TestSelectedLintUnits. The shared syntax-only fixture harness invokes the owning declaration-header rule and applies edits for complete literal output comparison in the same Go process without consumer installation, a native product build or a product host.
func TestFormatDeclarationHeaderTypeParamExplodeHonorsCRLFEndOfLine(t *testing.T) {
  assertFixCRLFConsistentWithOptions(
    t,
    "format/declaration-header",
    "class E<TVeryLongTypeParam extends SomeConstraint = DefaultType> {\r\n  a = 1;\r\n}\r\n",
    `{"printWidth":50,"tabWidth":2,"endOfLine":"crlf"}`,
    "class E<\r\n  TVeryLongTypeParam extends SomeConstraint =\r\n    DefaultType,\r\n> {\r\n  a = 1;\r\n}\r\n",
  )
}
