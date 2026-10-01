package linthost

import "testing"

// TestFormatSemiPreferNeverStripsACommaMemberSeparator verifies semi:false
// drops a `,` separator wherever it drops a `;`.
//
// The separator's spelling never changes what the oracle wants: a broken
// interface body prints `ifBreak(semi, ";")` between its members, which is
// nothing under semi:false, and its trailing separator is silenced the same
// way. Prettier 3.8.3 returns this body with neither `,` nor `;`, so a rule
// that owned only the `;` spelling would leave a comma-separated body
// diverging in exactly the direction #1166 fixed for semicolons.
//
//  1. Parse an interface whose members are `,`-separated, including a
//     trailing one before the closing brace.
//  2. Apply format/semi with prefer:"never".
//  3. Assert both commas are removed.
//
// @evidence contracts/testing.md#behavioral-verification format/semi must remove both broken-interface comma separators under never while preserving its number/string member declarations.
// @evidence contracts/testing.md#independent-expectations The literal expected broken-interface output follows the semi:false omission convention for interior and final separators, independent of the written comma spelling.
// @evidence contracts/testing.md#distinguishing-cases An interior comma and a trailing comma must both change; flat or hazard-required comma normalization cases own the complementary retained-separator decisions.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiPreferNeverStripsACommaMemberSeparator is a public Go unit selected by TestSelectedLintUnits. This entry owns every literal declaration in its fixture; the shared syntax-only harness invokes the semicolon rule and applies edits for its complete output comparison in the same process without a consumer install, native product build or host execution.
func TestFormatSemiPreferNeverStripsACommaMemberSeparator(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/semi",
    "interface Shape {\n  alpha: number,\n  bravo: string,\n}\n",
    `{"prefer":"never"}`,
    "interface Shape {\n  alpha: number\n  bravo: string\n}\n",
  )
}
