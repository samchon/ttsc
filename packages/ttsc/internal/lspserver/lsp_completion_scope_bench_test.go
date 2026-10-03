package lspserver

import (
  "strings"
  "testing"
)

// BenchmarkCursorInJSDoc times direct scope classification and its true check
// for one repeated buffer exceeding one MiB, ending inside an open JSDoc block.
//
// The end cursor requires scanning this full authored prefix. This is not a
// universal worst-case source or a measured real-file distribution; no latency
// bound, completion request, tsgo round trip, or relative performance is asserted.
// Buffer setup precedes ResetTimer; the timed loop includes the scope check.
//
// Usage:
//
//  go test ./internal/lspserver -run=^$ -bench=^BenchmarkCursorInJSDoc$
//
// @evidence contracts/testing.md#behavioral-verification The timed loop calls cursorInJSDoc at the end of one buffer exceeding one MiB and fails unless the trailing open JSDoc is recognized. Timing includes that check, has no asserted threshold, and does not certify universal worst-case cost, real-file size, completion latency, or tsgo comparison.
// @evidence contracts/testing.md#independent-expectations The in-loop check that the cursor is in a doc comment is the literal oracle; the timing itself is only measured, not asserted.
// @evidence contracts/testing.md#distinguishing-cases Only this end-of-buffer open-JSDoc position is timed. Repeated chunks contain closed JSDoc, quoted delimiter text, regex, and template interpolation; no negative scope outcome or alternate cursor position is asserted here.
// @evidence contracts/testing.md#execution-ownership Owns constructed strings and direct in-process cursorInJSDoc calls through Go's benchmark entry. Ordinary go test does not invoke the benchmark without selection; Evidence's configured source inventory still selects its declaration. No native fixture, Program, completion protocol, child process, or installed consumer is owned.
func BenchmarkCursorInJSDoc(b *testing.B) {
  chunk := strings.Join([]string{
    "/**",
    " * Greets one user.",
    " * @param name user name",
    " */",
    "export function greet(name: string): string {",
    "  const quoted = \"/** not a doc comment */\";",
    "  const pattern = /[\"'/*]/;",
    "  return `Hello, ${name}${quoted.length / 2}`;",
    "}",
    "",
  }, "\n")
  text := strings.Repeat(chunk, 1+1024*1024/len(chunk))
  text += "\n/**\n * @par"

  b.SetBytes(int64(len(text)))
  b.ResetTimer()
  for range b.N {
    if !cursorInJSDoc(text, len(text)) {
      b.Fatal("the trailing doc comment must be in scope")
    }
  }
}
