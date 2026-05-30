package linthost

import "testing"

// TestFormatDeclarationHeaderBreaksMultiTypeInterface verifies a single
// `extends` clause with multiple types breaks before the keyword and
// lists one type per line, matching Prettier 3.
//
// ttsc previously left such an over-width header verbatim (Prettier-2
// "break before extends only" shape). The rule reflows only the header
// up to `{`; the body is untouched.
//
//  1. Parse an interface whose extends list overflows printWidth 50.
//  2. Apply format/declaration-header.
//  3. Assert the keyword breaks and each type lands on its own line.
func TestFormatDeclarationHeaderBreaksMultiTypeInterface(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/declaration-header",
    "interface B extends First, Second, Third, Fourth, Fifth, Sixth {\n  a: number;\n}\n",
    `{"printWidth":50,"tabWidth":2}`,
    "interface B\n  extends\n    First,\n    Second,\n    Third,\n    Fourth,\n    Fifth,\n    Sixth {\n  a: number;\n}\n",
  )
}
