package graph

import (
  "unicode/utf8"

  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// ECMALineStarts returns the byte offset of each logical source line. The
// compiler is the authority for which bytes end a line, so graph evidence and
// graph-backed LSP locations cannot drift from its LF, CRLF, CR, LS, and PS
// coordinates.
//
// @evidence contracts/common.md#principled-implementation Compiler-produced ECMA line boundaries are copied into graph byte-offset coordinates without substituting a newline convention.
// @evidence contracts/common.md#clear-and-simple-design This adapter centralizes the compiler-to-graph integer representation so consumers share the same line model.
// @evidence contracts/common.md#prohibited-implementation-shortcuts All supported source text uses the compiler API; no fixture-specific terminator table or foreign mutation is introduced.
// @evidence contracts/common.md#meaningful-documentation The native comment explains byte units and the compiler authority for line terminators, following the documentation skill's separated prose and tags.
// @evidence contracts/performance.md#efficient-algorithms Computing boundaries is linear in source bytes and copying is linear in line count, with one output allocation.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This pure adapter does not coordinate requests; source-snapshot owners retain its resulting line index.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned slice transfers to the caller and this function retains no source text or index.
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
//
// @evidence contracts/common.md#principled-implementation The supplied index bounds one logical line and ECMA terminator widths identify its exclusive content end.
// @evidence contracts/common.md#clear-and-simple-design One bounded scan handles all compiler terminators without allocating a substring or rebuilding the line index.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Invalid line indices return the documented text boundary rather than manufacturing fixture-specific spans.
// @evidence contracts/common.md#meaningful-documentation The native comment identifies byte units, final-line behavior and the same-text index precondition under the documentation skill.
// @evidence contracts/performance.md#efficient-algorithms Index lookup is constant time and scanning costs only the selected line's byte length, with constant temporary space.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This calculation consumes a caller-owned reusable line index and creates no cross-request computation owner.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No retained state or native resource is acquired.
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
//
// The compiler scanner also recognizes Unicode whitespace, shebangs and
// conflict-marker trivia. Negative offsets return zero; offsets at or past EOF
// are returned unchanged without entering the scanner.
//
// @evidence contracts/common.md#principled-implementation Compiler SkipTrivia supplies the actual ECMA whitespace, comment, shebang and conflict-marker boundaries for the declaration's byte coordinate.
// @evidence contracts/common.md#clear-and-simple-design One guarded adapter delegates lexical policy to the compiler instead of maintaining a partial parallel scanner.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The supported scanner API handles all source trivia without a declaration-banner exception or foreign parser mutation.
// @evidence contracts/common.md#meaningful-documentation The native comment explains the leading-trivia adjustment; tags remain separated as required by the documentation skill.
// @evidence contracts/performance.md#efficient-algorithms Each traversed trivia byte is visited at most once and no intermediate text is allocated.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This span calculation does not own a request cache; its text and starting offset determine a single result.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The function retains no text, indices or tasks after returning.
func FirstCodeOffset(text string, pos int) int {
  if pos < 0 {
    return 0
  }
  if pos >= len(text) {
    return pos
  }
  return shimscanner.SkipTrivia(text, pos)
}

// LineCommentEnd returns the byte offset immediately after a // comment and
// its line terminator, or len(text) when the comment reaches EOF.
//
// @evidence contracts/common.md#principled-implementation A forward UTF-8 scan recognizes the same ECMA terminator widths as source indexing and includes the complete terminator in its result.
// @evidence contracts/common.md#clear-and-simple-design One shared helper gives trivia and signature compaction a common line-comment boundary.
// @evidence contracts/common.md#prohibited-implementation-shortcuts EOF and terminators follow source syntax without a hardcoded comment shape or parser patch.
// @evidence contracts/common.md#meaningful-documentation The native comment defines the exclusive byte offset and EOF behavior, with documentation-skill spacing before tags.
// @evidence contracts/performance.md#efficient-algorithms Cost is linear in this comment's bytes and temporary space is constant.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The helper computes one comment boundary and does not coordinate repeated requests.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No resources or source snapshots are retained by this calculation.
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
