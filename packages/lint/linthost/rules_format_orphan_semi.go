package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// formatOrphanSemi merges a lone leading-semicolon ASI guard onto the
// statement it protects, matching Prettier under semi:false:
//
//  ;
//  (expr).method()
//
// becomes `;(expr).method()`. Authors write the standalone `;` so ASI
// does not glue a `(`/`[`/“ ` “-leading statement onto the previous
// line; Prettier keeps the guard but pulls it onto the guarded
// statement's line.
//
// Scope is deliberately narrow and safe: it acts only under semi:false
// (the guard is a no-semicolon idiom) and only when the next statement
// begins with an ASI-hazard token, so the `;` is genuinely required and
// the edit just deletes the whitespace gap. Every other empty statement
// (trailing `;`, a non-hazard successor, a comment in between, semi:true)
// is left alone, dropping a redundant `;` safely depends on the
// surrounding semicolon policy and is out of scope here. Idempotent:
// once merged the gap holds no newline, so the rule finds nothing to do.
type formatOrphanSemi struct{}

// formatOrphanSemiOptions carries the effective `semi` setting, mirrored
// from format.semi by the config layer. Defaults to true (semicolons),
// in which case the rule never acts.
type formatOrphanSemiOptions struct {
  Semi *bool `json:"semi"`
}

func (formatOrphanSemi) Name() string   { return "format/orphan-semi" }
func (formatOrphanSemi) IsFormat() bool { return true }

func (formatOrphanSemi) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindEmptyStatement}
}

func (formatOrphanSemi) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil || node == nil {
    return
  }
  var opts formatOrphanSemiOptions
  _ = ctx.DecodeOptions(&opts)
  // Only the semi:false guard idiom is in scope.
  if opts.Semi == nil || *opts.Semi {
    return
  }

  src := ctx.File.Text()
  semiPos := shimscanner.SkipTrivia(src, node.Pos())
  semiEnd := node.End()
  if semiPos < 0 || semiEnd > len(src) || semiPos >= semiEnd || src[semiEnd-1] != ';' {
    return
  }
  // The `;` must be the first token on its line, a true orphan guard,
  // not a trailing empty statement after other code.
  lineStart := lineStartOffset(src, semiPos)
  for i := lineStart; i < semiPos; i++ {
    if src[i] != ' ' && src[i] != '\t' {
      return
    }
  }

  // Find the next significant byte. A comment in the gap is left alone
  // (the merge would have to reposition it).
  i := semiEnd
  for i < len(src) {
    c := src[i]
    if c == ' ' || c == '\t' || c == '\r' || c == '\n' {
      i++
      continue
    }
    if c == '/' && i+1 < len(src) && (src[i+1] == '/' || src[i+1] == '*') {
      return
    }
    break
  }
  if i >= len(src) {
    return
  }
  // Merge only when the next statement begins with an ASI-hazard token,
  // so the `;` is genuinely the guard Prettier keeps.
  switch src[i] {
  case '(', '[', '`':
  default:
    return
  }
  if i <= semiEnd {
    return // already adjacent (idempotent no-op)
  }
  ctx.ReportRangeFix(
    semiEnd,
    i,
    "Merge the leading-semicolon ASI guard onto its statement.",
    TextEdit{Pos: semiEnd, End: i, Text: ""},
  )
}

func init() {
  Register(formatOrphanSemi{})
}
