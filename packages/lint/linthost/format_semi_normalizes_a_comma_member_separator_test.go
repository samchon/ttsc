package linthost

import "testing"

// TestFormatSemiNormalizesACommaMemberSeparator verifies an authored `,`
// member separator is rewritten to the `;` Prettier prints, in both the
// broken and the flat layout.
//
// TypeScript accepts `,` as a type-member separator and the parser folds
// it into the member's range exactly as it folds a `;`, so an insert that
// looked only at "no `;` here" would emit `alpha: number,;`. Prettier 3.8.3
// prints `;` for every separator it keeps under semi:"always", whatever the
// layout, so no line-structure or break test guards this rewrite — it is a
// separator normalization rather than a terminator insert. The flat literal
// is the half that proves it: its bare last member stays bare (Prettier
// prints no trailing separator in a flat list) while its inter-member `,`
// still becomes `;`. This replaces the earlier expectation that the comma
// was left as written, which was short of the oracle by one owner.
//
//  1. Parse a broken interface and a flat type literal, each separated
//     with `,`.
//  2. Apply format/semi through the disk-backed fixer.
//  3. Assert every `,` separator becomes `;`, the broken list's last
//     member gains one, and the flat list's last member does not.
//
// @evidence contracts/testing.md#behavioral-verification format/semi must replace type-member commas with semicolons in both broken and flat lists, inserting the broken final terminator while keeping the flat final member bare.
// @evidence contracts/testing.md#independent-expectations The independently authored complete output specifies separator spelling and layout-dependent final termination while retaining all four number/string member annotations.
// @evidence contracts/testing.md#distinguishing-cases Broken interface and flat type-literal inputs share one host; exact output distinguishes comma replacement from comma-plus-semicolon insertion and final-member overtermination.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiNormalizesACommaMemberSeparator is a public Go unit selected by TestSelectedLintUnits. This entry owns every literal declaration in its fixture; the shared syntax-only harness invokes the semicolon rule and applies edits for its complete output comparison in the same process without a consumer install, native product build or host execution.
func TestFormatSemiNormalizesACommaMemberSeparator(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/semi",
    "interface Shape {\n  alpha: number,\n  bravo: string\n}\n"+
      "type Flat = { charlie: number, delta: string };\n",
    "interface Shape {\n  alpha: number;\n  bravo: string;\n}\n"+
      "type Flat = { charlie: number; delta: string };\n",
  )
}
