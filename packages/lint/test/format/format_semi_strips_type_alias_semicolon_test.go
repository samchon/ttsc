package linthost

import "testing"

// TestFormatSemiStripsTypeAliasSemicolon verifies semi:false removes the
// terminator of a top-level `type` alias declaration.
//
// A type alias is a statement-position declaration; Prettier drops its
// `;` under semi:false. The rule previously excluded it from
// preferNeverSafeKind out of an over-broad parse-hazard concern; the
// nextStatementHasASIHazard guard already covers the real risk.
//
//  1. Parse a single type-alias statement ending in `;`.
//  2. Apply format/semi with prefer:"never".
//  3. Assert the terminator is removed.
func TestFormatSemiStripsTypeAliasSemicolon(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/semi",
    "type T = number;\n",
    `{"prefer":"never"}`,
    "type T = number\n",
  )
}
