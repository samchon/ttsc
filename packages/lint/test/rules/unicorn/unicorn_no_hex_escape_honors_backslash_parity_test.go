package linthost

import (
  "fmt"
  "strings"
  "testing"
)

// TestUnicornNoHexEscapeHonorsBackslashParity verifies only a `\x` opened by
// an active backslash reports.
//
// Upstream anchors its match on `(?<=(?:^|[^\\])(?:\\\\)*\\)x`, a lookbehind
// RE2 cannot express: the `x` counts only when its backslash follows an
// even-length backslash run. The Go port used to match the bare `\xHH` text,
// so `"\\x64"` — an escaped backslash followed by the literal characters
// `x64` — falsely reported (issue #574). Every odd run is a positive and its
// even twin one backslash away is a negative, in both a string literal and a
// template payload, so a parity miscount fires in one direction or the other.
//
//  1. Prefix `x41` with one through six backslashes inside a string literal
//     and inside a template head.
//  2. Assert the odd runs report exactly the literal's token range and the
//     even runs stay silent.
//  3. Assert a run that starts mid-payload, after a plain character, is
//     counted from that character and not from the payload start.
func TestUnicornNoHexEscapeHonorsBackslashParity(t *testing.T) {
  for backslashes := 1; backslashes <= 6; backslashes++ {
    run := strings.Repeat(`\`, backslashes)
    active := backslashes%2 == 1
    t.Run(fmt.Sprintf("string with %d leading backslashes", backslashes), func(t *testing.T) {
      literal := `"` + run + `x41"`
      source := "const s = " + literal + ";\n"
      if !active {
        assertRuleFindingRanges(t, unicornNoHexEscapeRuleName, source)
        return
      }
      assertRuleFindingRanges(t, unicornNoHexEscapeRuleName, source, literal)
    })
    t.Run(fmt.Sprintf("template head with %d leading backslashes", backslashes), func(t *testing.T) {
      head := "`" + run + "x41${"
      source := "const s = " + head + "a}`;\n"
      if !active {
        assertRuleFindingRanges(t, unicornNoHexEscapeRuleName, source)
        return
      }
      assertRuleFindingRanges(t, unicornNoHexEscapeRuleName, source, head)
    })
  }
  t.Run("run restarts after a plain character", func(t *testing.T) {
    literal := `"a\\b\x41"`
    assertRuleFindingRanges(
      t,
      unicornNoHexEscapeRuleName,
      "const s = "+literal+";\n",
      literal,
    )
  })
  t.Run("plain character does not revive an even run", func(t *testing.T) {
    assertRuleFindingRanges(t, unicornNoHexEscapeRuleName, "const s = "+`"a\\bx41"`+";\n")
  })
}
