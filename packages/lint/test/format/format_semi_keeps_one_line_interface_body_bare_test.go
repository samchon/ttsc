package linthost

import "testing"

// TestFormatSemiKeepsOneLineInterfaceBodyBare verifies the insert direction
// abstains while the body is still written on one line.
//
// The negative twin of the broken-body case: Prettier prints a member's
// terminator inside an `ifBreak`, so a list that has not broken separates
// its members with `;` and leaves the last one bare. Inserting here would
// emit `interface Alpha { alpha: number; }`, a shape Prettier never
// produces, and the same condition is what keeps an inline object type,
// which no pass breaks, in the shape Prettier preserves. The cascade
// instead lets format/indent break the body first and terminates the
// members on the next pass.
//
//  1. Parse two one-line interfaces, one member and two members. The
//     interior `;` of the second is a separator, not a terminator, so it
//     must not draw an edit either.
//  2. Run format/semi with default options.
//  3. Assert the rule reports nothing.
//
// @evidence contracts/testing.md#behavioral-verification format/semi must offer no insertion for the last member of either singleton or two-member flat interface bodies, preserving their existing interior separator.
// @evidence contracts/testing.md#independent-expectations The literal one-line type lists follow the ifBreak terminator convention: the interior semicolon separates members while the final member stays bare until the body breaks.
// @evidence contracts/testing.md#distinguishing-cases This flat singleton/pair negative contrasts with the seven-kind broken-interface insertion positive; it observes zero findings rather than claiming to perform body breaking.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiKeepsOneLineInterfaceBodyBare is a selected public Go unit under TestSelectedLintUnits. The shared syntax-only fixture harness calls the owning semicolon rule and observes zero findings in the same Go process without a consumer install, native product build or product host.
func TestFormatSemiKeepsOneLineInterfaceBodyBare(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/semi",
    "interface Alpha { alpha: number }\ninterface Bravo { alpha: number; bravo: string }\n",
  )
}
