package linthost

import "testing"

// TestFormatDeclarationHeaderBreaksMultipleClauses verifies a class with
// both `extends` and `implements` breaks each clause onto its own line
// with the types inline and `{` on its own line, matching Prettier 3.
//
//  1. Parse a class whose extends+implements header overflows printWidth 50.
//  2. Apply format/declaration-header.
//  3. Assert each clause is on its own indented line and `{` stands alone.
//
// @evidence contracts/testing.md#behavioral-verification format/declaration-header must break extends and implements onto separate lines at width fifty while retaining Base, all four interface names and the a initializer.
// @evidence contracts/testing.md#independent-expectations The full literal output records the documented Prettier-three multi-clause layout with a standalone brace; inheritance and class body tokens are independent semantic invariants.
// @evidence contracts/testing.md#distinguishing-cases The overflowing nongeneric multi-clause header is the changed positive counterpart to the generic-plus-multiple-clause abstention and fitting-header canonicalization.
// @evidence contracts/testing.md#execution-ownership TestFormatDeclarationHeaderBreaksMultipleClauses is selected by TestSelectedLintUnits as a public Go unit. The owning formatter rule runs through the shared syntax-only rule harness on temporary fixture source; this entry owns its assertions and any named subtests without consumer installation, native product build or host process.
func TestFormatDeclarationHeaderBreaksMultipleClauses(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/declaration-header",
    "class C extends Base implements First, Second, Third, Fourth {\n  a = 1;\n}\n",
    `{"printWidth":50,"tabWidth":2}`,
    "class C\n  extends Base\n  implements First, Second, Third, Fourth\n{\n  a = 1;\n}\n",
  )
}
