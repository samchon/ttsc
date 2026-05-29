package linthost

import "testing"

// TestFormatDeclarationHeaderBreaksMultipleClauses verifies a class with
// both `extends` and `implements` breaks each clause onto its own line
// with the types inline and `{` on its own line, matching Prettier 3.
//
//  1. Parse a class whose extends+implements header overflows printWidth 50.
//  2. Apply format/declaration-header.
//  3. Assert each clause is on its own indented line and `{` stands alone.
func TestFormatDeclarationHeaderBreaksMultipleClauses(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/declaration-header",
    "class C extends Base implements First, Second, Third, Fourth {\n  a = 1;\n}\n",
    `{"printWidth":50,"tabWidth":2}`,
    "class C\n  extends Base\n  implements First, Second, Third, Fourth\n{\n  a = 1;\n}\n",
  )
}
