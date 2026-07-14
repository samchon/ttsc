package linthost

import (
  "fmt"
  "strings"
  "testing"
)

// TestUnicornEscapeCaseHonorsBackslashParity verifies only an escape opened
// by an active backslash reports.
//
// Upstream anchors its match on a lookbehind RE2 cannot express,
// `(?<=(?:^|[^\\])(?:\\\\)*\\)`: the escape counts only when its backslash
// follows an even-length backslash run. The Go port used to match the bare
// `\xa9` text, so `"\\xa9"` — an escaped backslash followed by the literal
// characters `xa9` — falsely reported (issue #574). Every odd run is a
// positive and its even twin one backslash away is a negative, in both a
// string literal and a template payload, so a parity miscount fires in one
// direction or the other.
//
//  1. Prefix `xa9` with one through six backslashes inside a string literal
//     and inside a template head.
//  2. Assert the odd runs report exactly the literal's token range and the
//     even runs stay silent.
//  3. Assert a run that starts mid-payload, after a plain character, is
//     counted from that character and not from the payload start.
func TestUnicornEscapeCaseHonorsBackslashParity(t *testing.T) {
  for backslashes := 1; backslashes <= 6; backslashes++ {
    run := strings.Repeat(`\`, backslashes)
    active := backslashes%2 == 1
    t.Run(fmt.Sprintf("string with %d leading backslashes", backslashes), func(t *testing.T) {
      literal := `"` + run + `xa9"`
      source := "const s = " + literal + ";\n"
      if !active {
        assertRuleFindingRanges(t, unicornEscapeCaseRuleName, source)
        return
      }
      assertRuleFindingRanges(t, unicornEscapeCaseRuleName, source, literal)
    })
    t.Run(fmt.Sprintf("template head with %d leading backslashes", backslashes), func(t *testing.T) {
      head := "`" + run + "xa9${"
      source := "const s = " + head + "a}`;\n"
      if !active {
        assertRuleFindingRanges(t, unicornEscapeCaseRuleName, source)
        return
      }
      assertRuleFindingRanges(t, unicornEscapeCaseRuleName, source, head)
    })
  }
  t.Run("run restarts after a plain character", func(t *testing.T) {
    literal := `"a\\b\xa9"`
    assertRuleFindingRanges(
      t,
      unicornEscapeCaseRuleName,
      "const s = "+literal+";\n",
      literal,
    )
  })
  t.Run("plain character does not revive an even run", func(t *testing.T) {
    assertRuleFindingRanges(t, unicornEscapeCaseRuleName, "const s = "+`"a\\bxa9"`+";\n")
  })
}
