package lspserver

import "testing"

// TestLSPPositionConversionsSpanAstralAndCombiningRunes verifies that both
// position helper and its completion wrapper spend the supplied UTF-16 budget
// on nine authored ASCII, BMP, astral, combining and line-boundary inputs.
//
// The wrapper delegates to lspPositionToByteOffset; agreement between their
// outputs is not an independent implementation oracle. An astral rune is the
// boundary that separates the three counting schemes at once — four bytes, one
// rune, two UTF-16 units — and a combining mark is the boundary where two runes
// render as one grapheme but still cost two units.
//
//  1. Convert the column just past the identifier on lines built from ASCII, BMP
//     CJK, an astral rune, and a combining sequence.
//  2. Assert both converters return the same byte offset for each.
//  3. Assert the line walk, the end-of-line column, and an out-of-range column.
//
// @evidence contracts/testing.md#behavioral-verification The helper and its delegating wrapper return literal offsets on nine supplied positive cases, including LF, bare CR and CRLF line walks; the helper alone rejects column 99 past the final line. Direct utf16Length calls require four units for a mixed prefix and zero for empty text. Actual edits, completion requests and session negotiation are not executed.
// @evidence contracts/testing.md#independent-expectations Expected offsets are literal byte counts from the UTF-16 definition.
// @evidence contracts/testing.md#distinguishing-cases ASCII and BMP distinguish byte width, an astral rune distinguishes rune and UTF-16 width, and a combining sequence still counts its separate code points. Before-astral/end-of-line positions, three line separators, the helper's past-end refusal and empty width complete this authored matrix; malformed text and positions inside a surrogate pair are not covered.
// @evidence contracts/testing.md#execution-ownership The discoverable Go unit directly calls lspPositionToByteOffset, offsetForPosition and utf16Length on authored strings. It uses no substitute operation, temporary directory, child, installed consumer or product host; the positive subtests remain individually named.
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

  cases = append(cases, struct { name string; text string; line int; character int; want int; wantOK bool }{
    "bare CR reaches target line", "a\rconst \U0001D499 = 1;", 1, 8, 12, true,
  }, struct { name string; text string; line int; character int; want int; wantOK bool }{
    "CRLF is one line boundary", "a\r\nconst \U0001D499 = 1;", 1, 8, 13, true,
  })

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

  // The direct helper rejects this past-end column; cache eviction is not
  // exercised by this call.
  if got, ok := lspPositionToByteOffset("const \U0001D499", lspPositionWire{Character: 99}); ok {
    t.Errorf("lspPositionToByteOffset past end = (%d, true), want ok=false", got)
  }

  // Independently authored width expectations exercise the width helper;
  // this does not construct a completion replacement range.
  if units := utf16Length("é\U0001D499"); units != 4 {
    t.Errorf("utf16Length = %d, want 4 (e + combining acute + astral pair)", units)
  }
  if units := utf16Length(""); units != 0 {
    t.Errorf("utf16Length of the empty filter = %d, want 0", units)
  }
}
