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
func TestFormatSemiPreferNeverStripsACommaMemberSeparator(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/semi",
    "interface Shape {\n  alpha: number,\n  bravo: string,\n}\n",
    `{"prefer":"never"}`,
    "interface Shape {\n  alpha: number\n  bravo: string\n}\n",
  )
}
