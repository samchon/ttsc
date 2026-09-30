package linthost

import "testing"

// TestFormatSemiPreferNeverStripsAFlatObjectTypesTrailingSeparator verifies
// the flat-list rule does not over-reach to the last member's terminator.
//
// The boundary between the two halves of Prettier's answer is the closing
// `}`. Between two members the flat branch of `ifBreak(semi, ";")` prints
// `";"`, which is why the separator in the sibling case survives semi:false;
// after the last member the whole separator sits inside a further `ifBreak`
// that resolves to nothing in a flat list, in either `semi` mode. So
// Prettier 3.8.3 returns `type Flat = { alpha: number; };` as
// `type Flat = { alpha: number }`, and a strip that keyed on "the list is
// flat" alone would leave a `;` the oracle never prints.
//
//  1. Parse a flat object type whose only member is terminated.
//  2. Apply format/semi with prefer:"never".
//  3. Assert the member terminator and the statement terminator both go.
//
// @evidence contracts/testing.md#behavioral-verification format/semi must remove the flat singleton type-member final separator and its outer alias terminator under never, preserving the alpha:number annotation.
// @evidence contracts/testing.md#independent-expectations The independently authored literal output distinguishes trailing punctuation from required interior flat-list separators and retains the type alias meaning.
// @evidence contracts/testing.md#distinguishing-cases This changed final-member separator complements retained flat inter-member separators and default flat-member no-insertion cases.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiPreferNeverStripsAFlatObjectTypesTrailingSeparator is a public Go unit selected by TestSelectedLintUnits. The shared syntax-only fixture harness invokes the owning semicolon rule and applies edits for complete literal output comparison in the same Go process without consumer installation, a native product build or a product host.
func TestFormatSemiPreferNeverStripsAFlatObjectTypesTrailingSeparator(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/semi",
    "type Flat = { alpha: number; };\n",
    `{"prefer":"never"}`,
    "type Flat = { alpha: number }\n",
  )
}
