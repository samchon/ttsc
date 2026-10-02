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
//
// @evidence contracts/testing.md#behavioral-verification format/semi must keep the separator before a callable interface member while removing its safe final terminator under never.
// @evidence contracts/testing.md#independent-expectations The independently authored literal output preserves a:number followed by the call signature as distinct members; the separator prevents type continuation while the closing-brace boundary is safe.
// @evidence contracts/testing.md#distinguishing-cases One hazardous inter-member separator stays and one safe trailing terminator changes within the same interface, contrasting with ordinary property-only removal.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiKeepsTypeMemberSemiBeforeCallSignature is a public Go unit selected by the lint semantic-unit Evidence claim. The shared syntax-only fixture harness invokes the owning semicolon rule and applies edits for complete literal output comparison in the same Go process without consumer installation, a native product build or a product host.
func TestFormatSemiKeepsTypeMemberSemiBeforeCallSignature(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/semi",
    "interface D {\n  a: number;\n  (): void;\n}\n",
    `{"prefer":"never"}`,
    "interface D {\n  a: number;\n  (): void\n}\n",
  )
}
