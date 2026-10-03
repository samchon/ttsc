package lspserver

import (
  "strings"
  "testing"
)

// BenchmarkCursorInJSDoc measures the scope decision on the completion hot path.
//
// Completion asks it per request on the live buffer, so its cost has to stay
// small against the round trip to tsgo that the same request makes. The buffer
// here is deliberately larger than a real source file and the cursor sits at its
// end, which is the worst case for a forward scan: the whole prefix is walked.
//
// Usage:
//
//  go test ./internal/lspserver -run=^$ -bench=^BenchmarkCursorInJSDoc$
//
// @evidence contracts/testing.md#behavioral-verification The benchmark runs cursorInJSDoc over a buffer larger than a real source file with the cursor at the end, the worst case for a forward scan, and fails if the trailing doc comment is not recognized.
// @evidence contracts/testing.md#independent-expectations The in-loop check that the cursor is in a doc comment is the literal oracle; the timing itself is only measured, not asserted.
// @evidence contracts/testing.md#distinguishing-cases Only the worst-case position is measured; scope correctness cases live in the table tests.
// @evidence contracts/testing.md#execution-ownership BenchmarkCursorInJSDoc is a Go benchmark in the lspserver package run with go test -bench; it is never part of the correctness suite and starts no process.
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
