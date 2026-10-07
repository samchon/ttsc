package linthost

import "testing"

// TestFormatSemiTerminatesBrokenTypeLiteralMember verifies a type literal
// written across lines takes the terminator while an inline one does not.
//
// Prettier preserves an object type's authored wrap: a literal whose `{`
// is followed by a line break stays broken and terminates its members,
// and one written inline stays inline and leaves its last member bare.
// The direct insert checks both a break after the member and the type
// list's opening-brace wrap before a final-member insertion. These two
// fixtures distinguish broken and inline inputs; half-wrapped companions
// own the independent opening-versus-closing boundary distinction.
//
//  1. Parse a broken type literal and an inline one.
//  2. Apply format/semi through the disk-backed fixer.
//  3. Assert only the broken literal's member gains a `;`.
//
// @evidence contracts/testing.md#behavioral-verification format/semi must terminate the broken type-literal member while leaving the same annotated member in an inline literal bare.
// @evidence contracts/testing.md#independent-expectations The independently authored full output expresses layout-dependent trailing termination and preserves both string-typed properties and alias terminators.
// @evidence contracts/testing.md#distinguishing-cases Broken and inline singleton type bodies share one fixture as changed/unchanged twins; the half-wrapped mapped-type case owns the related opening-brace decision separately.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiTerminatesBrokenTypeLiteralMember is a public Go unit selected by the lint semantic-unit Evidence claim. The shared syntax-only fixture harness invokes the owning semicolon rule and applies edits for complete literal output comparison in the same Go process without consumer installation, a native product build or a product host.
func TestFormatSemiTerminatesBrokenTypeLiteralMember(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/semi",
    "type Broken = {\n  name: string\n};\ntype Inline = { name: string };\n",
    "type Broken = {\n  name: string;\n};\ntype Inline = { name: string };\n",
  )
}
