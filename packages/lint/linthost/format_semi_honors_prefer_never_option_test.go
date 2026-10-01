package linthost

import "testing"

// TestFormatSemiHonorsPreferNeverOption verifies the `prefer: "never"`
// branch strips trailing semicolons from both ASI-safe statements and
// ASI-safe class fields, matching Prettier semi:false.
//
// A class field's `;` is dropped only when removing it cannot change the
// parse — here the field is the last member before `}`, so it is safe.
// The hazardous case, where the next member begins with `[`/`(` and the
// `;` must be kept, is pinned by
// format_semi_keeps_class_field_semi_before_computed_member.
//
//  1. Parse a file with an expression statement and a class field, both
//     ending in `;`, with `prefer: "never"` configured.
//  2. Apply the rule's findings through the disk-backed fixer.
//  3. Assert both terminators are removed.
//
// @evidence contracts/testing.md#behavioral-verification format/semi must remove the safe expression and last class-field terminators under never while preserving the call argument and numeric initializer.
// @evidence contracts/testing.md#independent-expectations The literal output follows the semi:false safety convention; deleting only the two semicolons retains JSON.stringify(1) and x:number=0 meaning.
// @evidence contracts/testing.md#distinguishing-cases This changed statement-plus-field pair complements the default insertion direction and computed-member/ASI-hazard negatives that must retain separators.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiHonorsPreferNeverOption is a selected public Go unit under TestSelectedLintUnits. The shared syntax-only fixture harness calls the owning semicolon rule and applies edits for the complete literal output assertion in the same Go process without a consumer install, native product build or product host.
func TestFormatSemiHonorsPreferNeverOption(t *testing.T) {
  source := "JSON.stringify(1);\nclass A { x: number = 0; }\n"
  want := "JSON.stringify(1)\nclass A { x: number = 0 }\n"
  assertFixSnapshotWithOptions(t, "format/semi", source, `{"prefer":"never"}`, want)
}
