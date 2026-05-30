package linthost

import "testing"

// TestFormatSemiKeepsTypeMemberSemiBeforeCallSignature verifies a type
// member's `;` is kept when the next member is a call signature (`(`),
// while a member before the closing `}` is still stripped.
//
// In interface/type context a leading `[` is an index signature (safe to
// strip before), but a leading `(` is a call signature that would
// re-associate with the prior member's type, so Prettier keeps the `;`.
// This pins the type-member hazard set `(` / `<`, distinct from the
// class-field set.
//
//  1. Parse an interface whose first member precedes a call signature.
//  2. Apply format/semi with prefer:"never".
//  3. Assert the `;` before `(): void` is kept and the last member's is
//     stripped.
func TestFormatSemiKeepsTypeMemberSemiBeforeCallSignature(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/semi",
    "interface D {\n  a: number;\n  (): void;\n}\n",
    `{"prefer":"never"}`,
    "interface D {\n  a: number;\n  (): void\n}\n",
  )
}
