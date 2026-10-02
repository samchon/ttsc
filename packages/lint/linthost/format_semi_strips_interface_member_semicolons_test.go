package linthost

import "testing"

// TestFormatSemiStripsInterfaceMemberSemicolons verifies semi:false
// removes the trailing `;` from newline-separated interface members.
//
// The old rule visited only statement kinds plus class fields and type
// aliases, so interface PropertySignature members kept their `;` under
// prefer:"never" — the largest single divergence from Prettier found in
// the benchmark corpus. The member path now strips them when they are
// newline-separated (the last member before `}` included).
//
//  1. Parse an interface with two semicolon-terminated members.
//  2. Apply format/semi with prefer:"never".
//  3. Assert both member terminators are removed.
//
// @evidence contracts/testing.md#behavioral-verification format/semi must remove both newline-separated interface member terminators under never while retaining the number/string annotations and member order.
// @evidence contracts/testing.md#independent-expectations The independently authored full output records semi:false broken-interface layout with identical member declarations and braces.
// @evidence contracts/testing.md#distinguishing-cases The changed broken two-member interface complements flat-body separators that must remain and canonical already-stripped interface negatives.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiStripsInterfaceMemberSemicolons is a selected public Go unit under the lint semantic-unit Evidence claim. The shared syntax-only fixture harness calls the owning semicolon rule and applies edits for the complete literal output assertion in the same Go process without a consumer install, native product build or product host.
func TestFormatSemiStripsInterfaceMemberSemicolons(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/semi",
    "interface A {\n  a: number;\n  b: string;\n}\n",
    `{"prefer":"never"}`,
    "interface A {\n  a: number\n  b: string\n}\n",
  )
}
