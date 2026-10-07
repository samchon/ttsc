package graphsymbols

import (
  "testing"
  "unicode/utf8"

  "github.com/samchon/ttsc/packages/ttsc/internal/graph"
  "github.com/samchon/ttsc/packages/ttsc/internal/lspserver"
)

// TestPositionHelpersFollowECMALineTerminators verifies graph-backed LSP
// positions use the compiler's LF, CRLF, CR, LS, and PS line boundaries.
//
// An offset-to-position helper that counted only LF while its inverse counted
// CR too would map an editor cursor to a graph offset that returns on a
// different line. Literal starts and ends establish three authored logical
// lines; the test walks their UTF-8 boundaries, including an emoji, and requires
// a round trip. Columns are not compared to literal UTF-16 counts, so symmetric
// column mistakes can pass. No editor/server request is exercised.
//
// 1. Build three lines with each ECMAScript terminator.
// 2. Enumerate every valid cursor boundary before each terminator.
// 3. Convert each offset to UTF-16 LSP position and back to the same offset.
//
// @evidence contracts/testing.md#behavioral-verification Verifies graph-backed LSP positions use the compiler's LF, CRLF, CR, LS, and PS line boundaries.
// @evidence contracts/testing.md#independent-expectations Each case embeds one ECMAScript terminator (LF, CRLF, CR, LS or PS) in a three-line literal, so the expected line count (three) and the line of every offset follow from the language's line-terminator definition. Columns are checked only by an offset -> position -> offset round trip over every UTF-8 rune boundary (including the two-unit emoji), not against literal UTF-16 column numbers, so a column error made symmetrically by both helpers would not be detected.
// @evidence contracts/testing.md#distinguishing-cases Build three lines with each ECMAScript terminator; Enumerate every valid cursor boundary before each terminator; Convert each offset to UTF-16 LSP position and back to the same offset; the five terminator subtests differ only in the terminator, and a position on the line index just past the last line must not resolve (negative case). No empty-text or out-of-range-column input is exercised here.
// @evidence contracts/testing.md#execution-ownership Directly calls the maintained line and position helpers on authored UTF-8 strings in this process. Literal byte boundaries establish enumeration; round-trip column expectations share the two converters and are not a separate UTF-16 oracle. It creates no native fixture, loads no Program, installs no consumer, and starts no product process or editor/server connection.
func TestPositionHelpersFollowECMALineTerminators(t *testing.T) {
  cases := []struct {
    name       string
    terminator string
  }{
    {name: "LF", terminator: "\n"},
    {name: "CRLF", terminator: "\r\n"},
    {name: "CR", terminator: "\r"},
    {name: "LS", terminator: "\u2028"},
    {name: "PS", terminator: "\u2029"},
  }
  for _, tc := range cases {
    t.Run(tc.name, func(t *testing.T) {
      text := "alpha😀" + tc.terminator + "beta" + tc.terminator + "gamma"
      starts := graph.ECMALineStarts(text)
      if len(starts) != 3 {
        t.Fatalf("line starts = %v, want three lines", starts)
      }
      expectedStarts := []int{0, 9 + len(tc.terminator), 13 + 2*len(tc.terminator)}
      expectedEnds := []int{9, 13 + len(tc.terminator), len(text)}
      for line, start := range starts {
        end := graph.LineEnd(text, starts, line)
        if start != expectedStarts[line] || end != expectedEnds[line] {
          t.Fatalf("line %d boundaries = (%d, %d), want (%d, %d)", line, start, end, expectedStarts[line], expectedEnds[line])
        }
        for offset := start; ; {
          position := offsetToPosition(text, offset)
          if position.Line != line {
            t.Fatalf("offset %d position line = %d, want %d", offset, position.Line, line)
          }
          restored, ok := lspPositionToOffset(text, position)
          if !ok || restored != offset {
            t.Fatalf("offset %d -> %+v -> (%d, %t), want itself", offset, position, restored, ok)
          }
          if offset == end {
            break
          }
          _, size := utf8.DecodeRuneInString(text[offset:])
          if size == 0 {
            t.Fatal("unexpected zero-width UTF-8 rune")
          }
          offset += size
        }
      }
      if _, ok := lspPositionToOffset(text, lspserver.LSPPosition{Line: len(starts), Character: 0}); ok {
        t.Fatal("position on a nonexistent source line must not resolve")
      }
    })
  }
}
