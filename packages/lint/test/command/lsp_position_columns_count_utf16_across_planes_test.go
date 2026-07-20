package linthost

import "testing"

// TestLSPPositionColumnsCountUTF16AcrossPlanes verifies that every range the lint
// sidecar publishes measures its column in UTF-16 code units, whatever width the
// text before it happens to be.
//
// byteOffsetToLSPPosition is the single conversion behind diagnostic ranges,
// related locations, quickfix and suggestion workspace edits, and whole-document
// formatting edits, and the sidecar protocol carries no encoding field: ttscserver
// pins every session to UTF-16 at the initialize exchange
// (constrainInitializePositionEncoding), so tsgo's squiggle and this sidecar's
// squiggle on the same line have to agree by construction. An astral rune is the
// boundary where bytes, runes, and UTF-16 units all differ at once, and a
// combining mark is the boundary where one grapheme still costs two units.
//
//  1. Convert byte offsets in ASCII, BMP CJK, astral, and combining text.
//  2. Assert the line walk over both LF and CRLF endings.
//  3. Assert the clamping boundaries: negative, past-end, and mid-rune offsets.
func TestLSPPositionColumnsCountUTF16AcrossPlanes(t *testing.T) {
  cases := []struct {
    name          string
    text          string
    offset        int
    wantLine      int
    wantCharacter int
  }{
    {
      name:          "the start of the document",
      text:          "const value = 1;",
      offset:        0,
      wantCharacter: 0,
    },
    {
      name:          "ascii counts one unit per byte",
      text:          "const value = 1;",
      offset:        11,
      wantCharacter: 11,
    },
    {
      name:          "bmp cjk is one unit and three bytes",
      text:          "const 变量 = 1;",
      offset:        12,
      wantCharacter: 8,
    },
    {
      name:          "an astral rune is two units and four bytes",
      text:          "const \U0001D499 = 1;",
      offset:        10,
      wantCharacter: 8,
    },
    {
      name:          "a combining mark costs its own unit",
      text:          "const e\u0301 = 1;",
      offset:        9,
      wantCharacter: 8,
    },
    {
      name:          "a line feed starts the next line at column zero",
      text:          "a\nconst \U0001D499",
      offset:        12,
      wantLine:      1,
      wantCharacter: 8,
    },
    {
      name:          "a carriage return pair is one line break",
      text:          "a\r\nconst \U0001D499",
      offset:        13,
      wantLine:      1,
      wantCharacter: 8,
    },
    {
      name:          "an offset past the end clamps to the end",
      text:          "abc",
      offset:        99,
      wantCharacter: 3,
    },
    {
      name:          "a negative offset clamps to the start",
      text:          "abc",
      offset:        -5,
      wantCharacter: 0,
    },
    {
      name:          "an offset inside a rune stops before it",
      text:          "变",
      offset:        1,
      wantCharacter: 0,
    },
  }

  for _, testCase := range cases {
    t.Run(testCase.name, func(t *testing.T) {
      got := byteOffsetToLSPPosition(testCase.text, testCase.offset)
      if got.Line != testCase.wantLine || got.Character != testCase.wantCharacter {
        t.Errorf("byteOffsetToLSPPosition = {line:%d character:%d}, want {line:%d character:%d}",
          got.Line, got.Character, testCase.wantLine, testCase.wantCharacter)
      }
    })
  }
}
