package linthost

import "testing"

// TestLSPPositionColumnsCountUTF16AcrossPlanes verifies raw-text byte offsets
// become UTF-16 columns regardless of the preceding text's byte or scalar width.
//
// byteOffsetToLSPPosition converts raw-text offsets for whole-document edits;
// source-backed diagnostic and suggestion ranges use the compiler line-map
// adapter separately. The sidecar protocol has no encoding field: ttscserver
// pins sessions to UTF-16 at initialization. An astral rune is the
// boundary where bytes, runes, and UTF-16 units all differ at once, and a
// combining mark is the boundary where one grapheme still costs two units.
//
//  1. Convert byte offsets in ASCII, BMP CJK, astral, and combining text.
//  2. Assert the line walk over both LF and CRLF endings.
//  3. Assert the clamping boundaries: negative, past-end, and mid-rune offsets.
//
// @evidence contracts/testing.md#behavioral-verification The raw-text position converter produces literal line/UTF-16 columns for ASCII, BMP, astral and combining text, handles LF/CRLF/lone CR/Unicode line separators, and clamps negative, past-end and mid-rune byte offsets.
// @evidence contracts/testing.md#independent-expectations The authored numeric line/column table follows UTF-16 unit widths and the line-break set of the compiler line map that the converter is documented to agree with (LF, CR, CRLF, U+2028, U+2029; the LSP text-document spec itself lists only LF, CR and CRLF, so the two separator rows pin the compiler-parity choice rather than the LSP spec); no second converter or compiler line map generates expected coordinates.
// @evidence contracts/testing.md#distinguishing-cases Start, ASCII, three-byte BMP, four-byte astral and combining marks distinguish byte/scalar/grapheme counting. Original LF/CRLF and clamps remain; lone CR and Unicode separator controls cover the remaining supported line breaks.
// @evidence contracts/testing.md#execution-ownership Each authored raw string is passed directly to byteOffsetToLSPPosition in the Go process and compared with literal coordinates. The test owns the raw-text helper, while source-backed consumers have separate runtime paths; no native artifact, install or product process runs.
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
    {name: "lone carriage return starts a line", text: "a\rb", offset: 3, wantLine: 1, wantCharacter: 1},
    {name: "unicode line separator starts a line", text: "a\u2028b", offset: 5, wantLine: 1, wantCharacter: 1},
    {name: "unicode paragraph separator starts a line", text: "a\u2029b", offset: 5, wantLine: 1, wantCharacter: 1},
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
