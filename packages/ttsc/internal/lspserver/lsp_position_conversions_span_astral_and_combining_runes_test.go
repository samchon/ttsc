package lspserver

import "testing"

// TestLSPPositionConversionsSpanAstralAndCombiningRunes verifies that both
// proxy-side position converters spend a UTF-16 budget, not a byte or rune one,
// across every width a line can hold.
//
// UTF-16 is the encoding ttscserver pins for the whole session
// (constrainInitializePositionEncoding), so these two helpers are the contract
// for every feature that maps an editor column onto the cached buffer:
// incremental didChange splicing and plugin completion. An astral rune is the
// boundary that separates the three counting schemes at once — four bytes, one
// rune, two UTF-16 units — and a combining mark is the boundary where two runes
// render as one grapheme but still cost two units.
//
//  1. Convert the column just past the identifier on lines built from ASCII, BMP
//     CJK, an astral rune, and a combining sequence.
//  2. Assert both converters return the same byte offset for each.
//  3. Assert the line walk, the end-of-line column, and an out-of-range column.
func TestLSPPositionConversionsSpanAstralAndCombiningRunes(t *testing.T) {
  cases := []struct {
    name      string
    text      string
    line      int
    character int
    want      int
    wantOK    bool
  }{
    {
      name:      "ascii counts one unit per byte",
      text:      "const value = 1;",
      character: 11,
      want:      11,
      wantOK:    true,
    },
    {
      name:      "bmp cjk is one unit and three bytes",
      text:      "const 变量 = 1;",
      character: 8,
      want:      12,
      wantOK:    true,
    },
    {
      name:      "an astral rune is two units and four bytes",
      text:      "const \U0001D499 = 1;",
      character: 8,
      want:      10,
      wantOK:    true,
    },
    {
      name:      "a combining mark costs its own unit",
      text:      "const e\u0301 = 1;",
      character: 8,
      want:      9,
      wantOK:    true,
    },
    {
      name:      "the column before an astral rune stops before its bytes",
      text:      "const \U0001D499 = 1;",
      character: 6,
      want:      6,
      wantOK:    true,
    },
    {
      name:      "the walk reaches the target line first",
      text:      "a\nconst \U0001D499 = 1;",
      line:      1,
      character: 8,
      want:      12,
      wantOK:    true,
    },
    {
      name:      "the column at end of line is in range",
      text:      "const \U0001D499",
      character: 8,
      want:      10,
      wantOK:    true,
    },
  }

  for _, testCase := range cases {
    t.Run(testCase.name, func(t *testing.T) {
      got, ok := lspPositionToByteOffset(testCase.text, lspPositionWire{
        Line:      testCase.line,
        Character: testCase.character,
      })
      if got != testCase.want || ok != testCase.wantOK {
        t.Errorf("lspPositionToByteOffset = (%d, %t), want (%d, %t)",
          got, ok, testCase.want, testCase.wantOK)
      }
      completionOffset, completionOK := offsetForPosition(
        testCase.text,
        testCase.line,
        testCase.character,
      )
      if completionOffset != testCase.want || !completionOK {
        t.Errorf("offsetForPosition = (%d, %t), want (%d, true)",
          completionOffset, completionOK, testCase.want)
      }
    })
  }

  // A column past the end of the line is a cache/editor divergence, not a
  // clamped position: the buffer cache drops its entry rather than splice at a
  // guessed byte.
  if got, ok := lspPositionToByteOffset("const \U0001D499", lspPositionWire{Character: 99}); ok {
    t.Errorf("lspPositionToByteOffset past end = (%d, true), want ok=false", got)
  }

  // The completion replace range is measured in the same units, so the filter
  // width of a mixed-width prefix must agree with the columns above.
  if units := utf16Length("é\U0001D499"); units != 4 {
    t.Errorf("utf16Length = %d, want 4 (e + combining acute + astral pair)", units)
  }
  if units := utf16Length(""); units != 0 {
    t.Errorf("utf16Length of the empty filter = %d, want 0", units)
  }
}
