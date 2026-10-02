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
//
// @evidence contracts/testing.md#behavioral-verification format/semi must remove the optional top-level type-alias terminator under never while preserving T as number.
// @evidence contracts/testing.md#independent-expectations The independently authored full output follows the semi:false declaration convention and retains all type-alias tokens unchanged.
// @evidence contracts/testing.md#distinguishing-cases This changed single alias at EOF complements statement stripping and hazardous same-line/next-expression terminator preservation cases.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiStripsTypeAliasSemicolon is a selected public Go unit under the lint semantic-unit Evidence claim. The shared syntax-only fixture harness calls the owning semicolon rule and applies edits for the complete literal output assertion in the same Go process without a consumer install, native product build or product host.
func TestFormatSemiStripsTypeAliasSemicolon(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/semi",
    "type T = number;\n",
    `{"prefer":"never"}`,
    "type T = number\n",
  )
}
