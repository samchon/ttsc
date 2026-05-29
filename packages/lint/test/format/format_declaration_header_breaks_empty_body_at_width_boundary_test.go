package linthost

import "testing"

// TestFormatDeclarationHeaderBreaksEmptyBodyAtWidthBoundary verifies the
// flat-fit check charges the closing `}` of an empty body. The header below
// is 81 columns including the trailing `{}`, so Prettier 3.8.3 breaks it;
// without charging the `}` the rule would see 80 and wrongly keep it flat.
//
//  1. Parse an empty-body interface whose flat `… {}` form is 81 columns.
//  2. Apply format/declaration-header at printWidth 80.
//  3. Assert the keyword breaks (types stay inline, brace glued as `{}`).
func TestFormatDeclarationHeaderBreaksEmptyBodyAtWidthBoundary(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/declaration-header",
    "interface I extends Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, Bbbbbbbbbbbbbbbbbbbb {}\n",
    `{"printWidth":80,"tabWidth":2}`,
    "interface I\n  extends Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, Bbbbbbbbbbbbbbbbbbbb {}\n",
  )
}
