// maxLines: very long files are almost always doing more than one
// thing — the reader cannot hold the whole responsibility in their
// head, and follow-up changes tend to make the file longer rather than
// split it. ESLint's default ceiling is 300 lines, which @ttsc/lint
// mirrors as the only built-in threshold (option-decoding is deferred).
// https://eslint.org/docs/latest/rules/max-lines
//
// The rule counts every line in the file's source text — code,
// comments, and blank lines alike — because the goal is a hard cap on
// how much one file can hold, not a heuristic over "real" code. A file
// with N newline characters has N+1 lines unless the final character
// itself is a newline; in either case the count corresponds to the
// line on which the last byte appears. The finding is anchored at the
// first line that exceeded the limit (line `max+1`), matching ESLint
// so editor squiggles land on the offending row rather than the file's
// opening line.
package linthost

import (
  "fmt"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// maxLinesLimit is the line-count ceiling. Above this value the rule
// fires once for the file. Mirrors the ESLint default.
const maxLinesLimit = 300

type maxLines struct{}

func (maxLines) Name() string { return "max-lines" }
func (maxLines) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (maxLines) Check(ctx *Context, node *shimast.Node) {
  if ctx.File == nil {
    return
  }
  src := ctx.File.Text()
  count := countSourceLines(src)
  if count <= maxLinesLimit {
    return
  }
  // Anchor at the start of line `max+1` — the first line that pushed
  // the file past the limit. ESLint matches this anchor so editor
  // squiggles land on the offending row.
  pos := nthLineStart(src, maxLinesLimit)
  if pos < 0 || pos >= len(src) {
    pos = 0
  }
  end := pos + 1
  if end > len(src) {
    end = len(src)
  }
  if end <= pos {
    end = pos + 1
  }
  ctx.ReportRange(pos, end, fmt.Sprintf("File has too many lines (%d). Maximum allowed is %d.", count, maxLinesLimit))
}

// nthLineStart returns the byte offset where the (`n`+1)-th line
// begins (0-indexed: passing 0 returns 0, passing 1 returns the byte
// after the first `\n`). Returns -1 when the file has fewer lines.
func nthLineStart(src string, n int) int {
  if n <= 0 {
    return 0
  }
  seen := 0
  for i := 0; i < len(src); i++ {
    if src[i] == '\n' {
      seen++
      if seen == n {
        return i + 1
      }
    }
  }
  return -1
}

// countSourceLines returns the number of lines in `src`. Every `\n`
// terminates a line; a non-empty trailing fragment without a newline
// counts as one additional line. An empty source has zero lines.
func countSourceLines(src string) int {
  if len(src) == 0 {
    return 0
  }
  count := 0
  for i := 0; i < len(src); i++ {
    if src[i] == '\n' {
      count++
    }
  }
  if src[len(src)-1] != '\n' {
    count++
  }
  return count
}

func init() {
  Register(maxLines{})
}
