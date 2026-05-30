package linthost

import "testing"

// TestFormatDeclarationHeaderKeepsMultiTypeInlineAfterBreak verifies the
// two-tier layout of a single multi-type heritage clause: Prettier 3
// breaks before the keyword but keeps the types inline on that line, and
// only explodes them one-per-line when the inline line itself overflows.
//
// Here the flat header overflows printWidth 80 but the broken
// `  extends A, B, C {` line fits, so the types stay inline.
//
//  1. Parse an interface whose flat extends header overflows 80 but whose
//     broken-keyword line fits.
//  2. Apply format/declaration-header.
//  3. Assert the keyword breaks once and the types stay inline.
func TestFormatDeclarationHeaderKeepsMultiTypeInlineAfterBreak(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/declaration-header",
    "interface Iiiiiiiiiiiiiiiiii extends Firstttttttttttttttt, Secondddddddddddddddd, Third {\n  x: number;\n}\n",
    `{"printWidth":80,"tabWidth":2}`,
    "interface Iiiiiiiiiiiiiiiiii\n  extends Firstttttttttttttttt, Secondddddddddddddddd, Third {\n  x: number;\n}\n",
  )
}
