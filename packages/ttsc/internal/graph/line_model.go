package graph

import (
  "unicode/utf8"

  shimcore "github.com/microsoft/typescript-go/shim/core"
)

// ECMALineStarts returns the byte offset of each logical source line. The
// compiler is the authority for which bytes end a line, so graph evidence and
// graph-backed LSP locations cannot drift from its LF, CRLF, CR, LS, and PS
// coordinates.
func ECMALineStarts(text string) []int {
  compilerStarts := shimcore.ComputeECMALineStarts(text)
  starts := make([]int, len(compilerStarts))
  for i, start := range compilerStarts {
    starts[i] = int(start)
  }
  return starts
}

// LineEnd returns the byte offset immediately before line's terminator, or the
// end of text for its final logical line. starts must come from ECMALineStarts
// for the same text.
func LineEnd(text string, starts []int, line int) int {
  if line < 0 || line >= len(starts) {
    return len(text)
  }
  if line+1 == len(starts) {
    return len(text)
  }
  for i := starts[line]; i < starts[line+1]; {
    if lineTerminatorWidth(text, i) > 0 {
      return i
    }
    _, size := utf8.DecodeRuneInString(text[i:])
    if size == 0 {
      return len(text)
    }
    i += size
  }
  return starts[line+1]
}

// FirstCodeOffset advances over leading whitespace and comments so a graph
// span begins at its declaration rather than its leading trivia.
func FirstCodeOffset(text string, pos int) int {
  if pos < 0 {
    return 0
  }
  for pos < len(text) {
    width := sourceWhitespaceWidth(text, pos)
    switch {
    case width > 0:
      pos += width
    case text[pos] == '/' && pos+1 < len(text) && text[pos+1] == '/':
      pos = LineCommentEnd(text, pos)
    case text[pos] == '/' && pos+1 < len(text) && text[pos+1] == '*':
      pos += 2
      for pos+1 < len(text) && !(text[pos] == '*' && text[pos+1] == '/') {
        _, size := utf8.DecodeRuneInString(text[pos:])
        if size == 0 {
          return len(text)
        }
        pos += size
      }
      if pos+1 < len(text) {
        pos += 2
      } else {
        return len(text)
      }
    default:
      return pos
    }
  }
  return len(text)
}

// LineCommentEnd returns the byte offset immediately after a // comment and
// its line terminator, or len(text) when the comment reaches EOF.
func LineCommentEnd(text string, start int) int {
  for i := start + 2; i < len(text); {
    if width := lineTerminatorWidth(text, i); width > 0 {
      return i + width
    }
    _, size := utf8.DecodeRuneInString(text[i:])
    if size == 0 {
      return len(text)
    }
    i += size
  }
  return len(text)
}

func sourceWhitespaceWidth(text string, pos int) int {
  switch text[pos] {
  case ' ', '\t', '\r', '\n', '\v', '\f':
    return 1
  }
  r, size := utf8.DecodeRuneInString(text[pos:])
  if r == '\u2028' || r == '\u2029' {
    return size
  }
  return 0
}

func lineTerminatorWidth(text string, pos int) int {
  switch text[pos] {
  case '\r':
    if pos+1 < len(text) && text[pos+1] == '\n' {
      return 2
    }
    return 1
  case '\n':
    return 1
  }
  r, size := utf8.DecodeRuneInString(text[pos:])
  if r == '\u2028' || r == '\u2029' {
    return size
  }
  return 0
}
