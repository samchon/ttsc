// Package astutil exposes the AST/text helpers `@ttsc/lint` built-in rules
// already rely on, so third-party contributor rules can build autofixes
// without re-implementing trivia, keyword location, or token-range math.
//
// These helpers are deliberately byte-oriented to match the
// `rule.TextEdit` contract: positions returned from this package can be
// fed directly into a `TextEdit{Pos, End, Text}` literal.
//
// All functions are pure (no shared state) and safe to call from any
// goroutine — `*shimast.SourceFile` and `*shimast.Node` are read-only
// from the rule's perspective.
package astutil

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// NodeText returns the source text under `node` with leading trivia
// (whitespace + comments) stripped. Mirrors `nodeText` in the built-in
// engine — useful for rules that compare textual identity (the
// `no-self-assign` / `no-self-compare` shape) or that splice a sub-node's
// text into a fix string.
//
// Returns "" when `file` or `node` is nil, or when the computed range
// falls outside the file (defensive — shouldn't happen for engine-supplied
// nodes).
func NodeText(file *shimast.SourceFile, node *shimast.Node) string {
  if file == nil || node == nil {
    return ""
  }
  src := file.Text()
  end := node.End()
  pos := shimscanner.SkipTrivia(src, node.Pos())
  if pos < 0 || end > len(src) || pos >= end {
    return ""
  }
  return strings.TrimRight(src[pos:end], " \t\r\n")
}

// KeywordStart returns the source offset of a declaration keyword such as
// `var`, `let`, `const`, `module`, `namespace`, or `function` that lives
// at the start of `node` (after leading trivia). Returns -1 if not found.
//
// Use this to anchor TextEdits that swap a leading keyword:
//
//  start := astutil.KeywordStart(file, node, "let")
//  if start >= 0 {
//    ctx.ReportFix(node, "use const",
//      rule.TextEdit{Pos: start, End: start + len("let"), Text: "const"})
//  }
func KeywordStart(file *shimast.SourceFile, node *shimast.Node, keyword string) int {
  if file == nil || node == nil || keyword == "" {
    return -1
  }
  src := file.Text()
  pos := shimscanner.SkipTrivia(src, node.Pos())
  end := pos + len(keyword)
  if pos < 0 || end > len(src) {
    return -1
  }
  if strings.HasPrefix(src[pos:], keyword) && (end == len(src) || !isIdentifierPart(src[end])) {
    return pos
  }
  limit := node.End()
  if limit > len(src) {
    limit = len(src)
  }
  for i := pos; i+len(keyword) <= limit && i < pos+32; i++ {
    end = i + len(keyword)
    if strings.HasPrefix(src[i:], keyword) &&
      (i == 0 || !isIdentifierPart(src[i-1])) &&
      (end == len(src) || !isIdentifierPart(src[end])) {
      return i
    }
  }
  return -1
}

// FindKeyword scans `[pos, end)` for a keyword token whose lexeme is
// `keyword` and returns its first-byte offset, or -1 if not found.
// Differs from KeywordStart in that it works on an arbitrary byte range
// instead of a node's leading-trivia-adjusted start — use this for fixes
// that need to splice text after `import` or before `from`.
//
// The match is identifier-aware: a hit must be flanked by non-identifier
// bytes (or file edges) so that searching for `import` does not match
// the `import` prefix of `importMap`.
func FindKeyword(file *shimast.SourceFile, pos, end int, keyword string) int {
  if file == nil || keyword == "" {
    return -1
  }
  src := file.Text()
  if pos < 0 {
    pos = 0
  }
  if end > len(src) {
    end = len(src)
  }
  limit := end - len(keyword)
  for i := pos; i <= limit; i++ {
    if src[i] != keyword[0] {
      continue
    }
    tail := i + len(keyword)
    if src[i:tail] != keyword {
      continue
    }
    if i > 0 && isIdentifierPart(src[i-1]) {
      continue
    }
    if tail < len(src) && isIdentifierPart(src[tail]) {
      continue
    }
    return i
  }
  return -1
}

// TokenRange returns the `[pos, end)` range of a node's primary token
// with leading trivia stripped from the start. Useful for rules that
// want their diagnostic and fix range aligned to the token rather than
// the surrounding whitespace.
//
// Returns `(-1, -1)` when `file` or `node` is nil or when the computed
// range is malformed.
func TokenRange(file *shimast.SourceFile, node *shimast.Node) (int, int) {
  if file == nil || node == nil {
    return -1, -1
  }
  src := file.Text()
  pos := shimscanner.SkipTrivia(src, node.Pos())
  end := node.End()
  if pos < 0 || pos > len(src) || end < pos || end > len(src) {
    return -1, -1
  }
  return pos, end
}

func isIdentifierPart(ch byte) bool {
  return (ch >= 'a' && ch <= 'z') ||
    (ch >= 'A' && ch <= 'Z') ||
    (ch >= '0' && ch <= '9') ||
    ch == '_' ||
    ch == '$'
}
