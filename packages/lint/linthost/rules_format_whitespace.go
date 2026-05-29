package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// formatWhitespace performs file-level text hygiene, mirroring the
// whitespace normalization Prettier applies regardless of node shape:
//
//  (a) trailing whitespace (spaces, tabs, `\r`) before a `\n` is
//      trimmed;
//  (b) runs of two or more consecutive blank lines collapse to exactly
//      one blank line (Prettier keeps at most one);
//  (c) blank lines at the start of the file are removed;
//  (d) blank lines at the end of the file are removed and the file is
//      made to end with exactly one EOL.
//
// The rule emits targeted insert/delete TextEdits rather than a
// whole-file replacement. A whole-file replace would overlap the edits
// the structural format rules (`format/statement-split`,
// `format/indent`, `format/print-width`) produce on the same pass, and
// the applier rejects overlapping edits. Disjoint per-line edits compose
// with them cleanly.
//
// Template safety: bytes inside a template literal are significant —
// trailing spaces and blank lines there are part of the string value.
// The rule collects the byte ranges of every NoSubstitutionTemplate and
// TemplateExpression node (covering head/middle/tail spans and the
// interpolations between them) and skips any line whose terminating
// newline falls strictly inside such a range. The hygiene edits then
// only ever touch real source whitespace, never template content.
//
// Idempotent: a file that already has no trailing whitespace, at most
// one consecutive blank line, no leading/trailing blank lines, and a
// single final EOL produces no edits.
type formatWhitespace struct{}

// formatWhitespaceOptions carries only the EOL setting; the rule needs
// it to synthesize the file's final newline. Indentation is irrelevant
// here. JSON tag matches the `format` block key the config layer mirrors
// in (see `expandFormatBlock`).
type formatWhitespaceOptions struct {
  EndOfLine *string `json:"endOfLine"`
}

func (formatWhitespace) Name() string   { return "format/whitespace" }
func (formatWhitespace) IsFormat() bool { return true }
func (formatWhitespace) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}

func (formatWhitespace) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil {
    return
  }
  var opts formatWhitespaceOptions
  _ = ctx.DecodeOptions(&opts)
  eol := "\n"
  if opts.EndOfLine != nil && *opts.EndOfLine == "crlf" {
    eol = "\r\n"
  }
  src := ctx.File.Text()
  if len(src) == 0 {
    return
  }
  ranges := collectTemplateRanges(ctx.File, src)
  edits := whitespaceEdits(src, eol, ranges)
  if len(edits) == 0 {
    return
  }
  ctx.ReportRangeFix(
    edits[0].Pos,
    edits[0].End,
    "Normalize file whitespace.",
    edits...,
  )
}

// byteRange is a half-open [pos, end) span of source bytes.
type byteRange struct {
  pos int
  end int
}

// inTemplate reports whether byte offset `i` lies strictly inside any
// collected template-literal range. Strict containment (`i > pos`) lets
// a newline that merely abuts a template boundary still be normalized
// while a newline inside the literal's body is preserved.
func inTemplate(ranges []byteRange, i int) bool {
  for _, r := range ranges {
    if i > r.pos && i < r.end {
      return true
    }
  }
  return false
}

// whitespaceEdits computes the disjoint insert/delete edits that realize
// operations (a)-(d). It walks the file line by line, tracking blank
// lines so it can collapse runs and strip the leading/trailing blocks,
// and it consults `ranges` so no edit touches template-literal content.
func whitespaceEdits(src, eol string, ranges []byteRange) []TextEdit {
  var edits []TextEdit

  // Index every line as [start, contentEnd, newlinePos). newlinePos is
  // the offset of the line's terminating '\n', or len(src) for the last
  // line when the file does not end in a newline. contentEnd trims the
  // run of trailing spaces, tabs, and '\r' so the gap [contentEnd,
  // newlinePos) is exactly the trailing-whitespace the rule strips, and
  // a whitespace-only line reduces to contentEnd == start.
  type lineSpan struct {
    start      int
    contentEnd int
    newlinePos int // offset of '\n', or -1 when none (final line)
    inTpl      bool
  }
  var lines []lineSpan
  start := 0
  for i := 0; i <= len(src); i++ {
    if i == len(src) || src[i] == '\n' {
      newlinePos := -1
      if i < len(src) {
        newlinePos = i
      }
      inTpl := newlinePos >= 0 && inTemplate(ranges, newlinePos)
      contentEnd := i
      // A template-interior line keeps its bytes verbatim — its trailing
      // spaces are string content — so contentEnd is the raw line end.
      // Real source lines trim trailing spaces/tabs/'\r' so the gap
      // [contentEnd, newlinePos) is exactly what gets stripped and a
      // whitespace-only line reduces to contentEnd == start.
      if !inTpl {
        for contentEnd > start {
          c := src[contentEnd-1]
          if c != ' ' && c != '\t' && c != '\r' {
            break
          }
          contentEnd--
        }
      }
      lines = append(lines, lineSpan{
        start:      start,
        contentEnd: contentEnd,
        newlinePos: newlinePos,
        inTpl:      inTpl,
      })
      start = i + 1
    }
  }

  isBlank := func(ls lineSpan) bool {
    for i := ls.start; i < ls.contentEnd; i++ {
      if src[i] != ' ' && src[i] != '\t' {
        return false
      }
    }
    return true
  }

  // Identify the first and last content lines (non-blank, or
  // template-protected which always counts as content). Edits are kept
  // disjoint by partitioning the file into three regions: the leading
  // blank block [0, firstContent.start), the body [firstContent,
  // lastContent], and the trailing block after lastContent.contentEnd.
  firstContent := -1
  lastContent := -1
  for idx, ls := range lines {
    if ls.inTpl || !isBlank(ls) {
      if firstContent < 0 {
        firstContent = idx
      }
      lastContent = idx
    }
  }
  if firstContent < 0 {
    // Whole file is blank: collapse to a single EOL.
    if src != eol {
      edits = append(edits, TextEdit{Pos: 0, End: len(src), Text: eol})
    }
    return dedupeAndSort(src, edits)
  }

  // collapsed[idx] marks a blank body line whose entire span is deleted
  // by run-collapse (b); those lines must not also get a trailing-trim
  // edit (a), which would overlap the deletion.
  collapsed := make([]bool, len(lines))

  // (b) Collapse interior runs of 2+ blank lines to one blank line. A
  // run is a maximal sequence of blank, non-template lines between two
  // content lines. Keep the first blank line of the run; delete the full
  // span of every subsequent blank line in the run.
  idx := firstContent + 1
  for idx < lastContent {
    if !isBlank(lines[idx]) || lines[idx].inTpl {
      idx++
      continue
    }
    runStart := idx
    runEnd := idx
    for runEnd+1 <= lastContent && isBlank(lines[runEnd+1]) && !lines[runEnd+1].inTpl {
      runEnd++
    }
    if runEnd > runStart {
      delFrom := lines[runStart+1].start
      delTo := lines[runEnd].newlinePos + 1
      if delTo > len(src) {
        delTo = len(src)
      }
      edits = append(edits, TextEdit{Pos: delFrom, End: delTo, Text: ""})
      for k := runStart + 1; k <= runEnd; k++ {
        collapsed[k] = true
      }
    }
    idx = runEnd + 1
  }

  // (a) Trailing-whitespace trim, for body lines only (excluding the
  // last content line, whose tail is owned by (d), and collapsed lines,
  // whose span is owned by (b)). Template-protected lines are skipped so
  // string content survives.
  for i := firstContent; i < lastContent; i++ {
    ls := lines[i]
    if ls.inTpl || collapsed[i] {
      continue
    }
    rawEnd := ls.newlinePos
    if rawEnd < 0 {
      rawEnd = len(src)
    }
    if rawEnd > ls.contentEnd {
      edits = append(edits, TextEdit{Pos: ls.contentEnd, End: rawEnd, Text: ""})
    }
  }

  // (c) Remove leading blank lines: delete from file start up to the
  // first content line's start.
  if lines[firstContent].start > 0 {
    edits = append(edits, TextEdit{Pos: 0, End: lines[firstContent].start, Text: ""})
  }

  // (d) Remove trailing blank lines and any trailing whitespace on the
  // last content line, then guarantee exactly one final EOL: replace
  // everything after the last content line's content with a single EOL.
  last := lines[lastContent]
  if last.contentEnd < len(src) {
    edits = append(edits, TextEdit{Pos: last.contentEnd, End: len(src), Text: eol})
  } else {
    // File ends exactly at content with no newline: append one.
    edits = append(edits, TextEdit{Pos: len(src), End: len(src), Text: eol})
  }

  return dedupeAndSort(src, edits)
}

// dedupeAndSort drops no-op edits — an empty deletion of an empty range,
// or a replacement whose text already equals the bytes it covers — and
// returns the survivors ordered by position. Dropping equal-text
// replacements is what keeps the rule idempotent: a file that already
// ends in one EOL would otherwise re-emit a `\n`→`\n` edit forever. The
// applier expects disjoint edits; the construction above guarantees
// disjointness, so this only orders and prunes.
func dedupeAndSort(src string, edits []TextEdit) []TextEdit {
  out := edits[:0]
  for _, e := range edits {
    if e.Pos == e.End && e.Text == "" {
      continue
    }
    if e.Pos >= 0 && e.End <= len(src) && src[e.Pos:e.End] == e.Text {
      continue
    }
    out = append(out, e)
  }
  // Insertion sort: edit counts here are small (proportional to blank
  // runs), so a stable simple sort keeps the code obvious.
  for i := 1; i < len(out); i++ {
    for j := i; j > 0 && out[j-1].Pos > out[j].Pos; j-- {
      out[j-1], out[j] = out[j], out[j-1]
    }
  }
  return out
}

// collectTemplateRanges walks the file's AST and records the byte span
// of every template literal — NoSubstitutionTemplate literals and full
// TemplateExpression nodes (whose range spans the head, every
// interpolation, and the tail). Newlines inside these ranges carry
// string content and must not be touched by the whitespace edits.
func collectTemplateRanges(file *shimast.SourceFile, src string) []byteRange {
  var ranges []byteRange
  var walk func(node *shimast.Node)
  walk = func(node *shimast.Node) {
    if node == nil {
      return
    }
    switch node.Kind {
    case shimast.KindNoSubstitutionTemplateLiteral, shimast.KindTemplateExpression:
      pos := shimscanner.SkipTrivia(src, node.Pos())
      end := node.End()
      if pos >= 0 && end <= len(src) && end > pos {
        ranges = append(ranges, byteRange{pos: pos, end: end})
      }
    }
    node.ForEachChild(func(child *shimast.Node) bool {
      walk(child)
      return false
    })
  }
  if file != nil && file.Statements != nil {
    for _, stmt := range file.Statements.Nodes {
      walk(stmt)
    }
  }
  return ranges
}

func init() {
  Register(formatWhitespace{})
}
