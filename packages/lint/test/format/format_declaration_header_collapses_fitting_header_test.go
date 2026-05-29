package linthost

import "testing"

// TestFormatDeclarationHeaderCollapsesFittingHeader verifies a header
// broken across lines but short enough to fit is collapsed back to one
// line, matching Prettier.
//
// The rule reconstructs the header canonically: when the flat form fits
// printWidth it is the target, so a needlessly multi-line header is
// rejoined.
//
//  1. Parse an interface with a needlessly broken short header.
//  2. Apply format/declaration-header at printWidth 80.
//  3. Assert the header collapses onto one line.
func TestFormatDeclarationHeaderCollapsesFittingHeader(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/declaration-header",
    "interface F\n  extends A {\n  a: number;\n}\n",
    `{"printWidth":80,"tabWidth":2}`,
    "interface F extends A {\n  a: number;\n}\n",
  )
}
