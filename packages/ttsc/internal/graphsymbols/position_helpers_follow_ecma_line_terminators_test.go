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
// The old offset-to-position helper counted only LF while its inverse counted
// CR too, so an editor cursor could map to a graph offset that returned on a
// different line. The test walks every valid UTF-8 cursor boundary on each
// logical line, including a surrogate-pair column, and requires a round trip.
//
// 1. Build three lines with each ECMAScript terminator.
// 2. Enumerate every valid cursor boundary before each terminator.
// 3. Convert each offset to UTF-16 LSP position and back to the same offset.
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
      for line, start := range starts {
        end := graph.LineEnd(text, starts, line)
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
