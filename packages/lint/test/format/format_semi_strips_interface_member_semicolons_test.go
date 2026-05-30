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
func TestFormatSemiStripsInterfaceMemberSemicolons(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/semi",
    "interface A {\n  a: number;\n  b: string;\n}\n",
    `{"prefer":"never"}`,
    "interface A {\n  a: number\n  b: string\n}\n",
  )
}
