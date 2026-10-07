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
//
// @evidence contracts/testing.md#behavioral-verification format/declaration-header must count the empty-body closing brace in its fit budget, breaking the eighty-one-column header while retaining heritage and the empty body.
// @evidence contracts/testing.md#independent-expectations The literal complete line has eighty-one columns including both braces, while the adjacent shorter literal has exactly eighty; independently authored expected layout prevents a missing-brace fit charge.
// @evidence contracts/testing.md#distinguishing-cases The over-limit changed header and exact-limit unchanged twin distinguish the one-column boundary rather than merely testing a broadly oversized declaration.
// @evidence contracts/testing.md#execution-ownership TestFormatDeclarationHeaderBreaksEmptyBodyAtWidthBoundary is a public Go unit selected by the lint semantic-unit Evidence claim. Its shared syntax-only harness invokes the owning formatter on temporary fixture source and applies its reported edits for exact output assertions in the same process, without a consumer install, native product build or host execution.
func TestFormatDeclarationHeaderBreaksEmptyBodyAtWidthBoundary(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/declaration-header",
    "interface I extends Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, Bbbbbbbbbbbbbbbbbbbb {}\n",
    `{"printWidth":80,"tabWidth":2}`,
    "interface I\n  extends Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, Bbbbbbbbbbbbbbbbbbbb {}\n",
  )
  assertRuleSkipsSourceWithOptions(
    t,
    "format/declaration-header",
    "interface I extends Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, Bbbbbbbbbbbbbbbbbbbb {}\n",
    `{"printWidth":80,"tabWidth":2}`,
  )
}
