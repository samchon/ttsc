package linthost

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// formatStatementSplit puts every statement in a statement list on its
// own physical line, mirroring Prettier's "one statement per line"
// layout. Prettier never leaves two statements sharing a source line —
// `const a = 1; let b = 2;` becomes two lines — and this rule is the
// always-on equivalent.
//
// Scope is every statement list the language produces: the SourceFile
// body, every Block and ModuleBlock, and the statement lists of `case`
// and `default` clauses. The rule registers for KindSourceFile and
// walks the subtree itself (like `format/sort-imports` and
// `format/jsdoc`), emitting one finding that may carry many TextEdits.
//
// Per-statement decision:
//
//  1. Find the statement's first non-trivia byte.
//  2. If it is the first non-whitespace byte on its physical line, the
//     statement already starts its own line — abstain (that is
//     `format/indent`'s surface).
//  3. Otherwise another statement precedes it on the same line. Replace
//     the whitespace run immediately before the statement (back to the
//     previous non-whitespace char) with EOL + indent(depth).
//
// Safety: abstain for a statement whose inter-statement gap holds a
// `//` or `/*` comment. Re-emitting EOL + indent over that gap would
// delete the comment, so the rule leaves the bytes untouched and a
// later pass (or the user) handles it.
//
// Idempotent: once each statement is alone on its line, step 2 abstains
// for all of them and the rule emits nothing.
type formatStatementSplit struct{}

// formatStatementSplitOptions carries the indentation + EOL settings the
// rule needs to synthesize the inserted line break. The JSON tags match
// the `format` block keys the config layer mirrors in (see
// `expandFormatBlock` in config_format.go).
type formatStatementSplitOptions struct {
  TabWidth  *int    `json:"tabWidth"`
  UseTabs   *bool   `json:"useTabs"`
  EndOfLine *string `json:"endOfLine"`
}

func (formatStatementSplit) Name() string   { return "format/statement-split" }
func (formatStatementSplit) IsFormat() bool { return true }
func (formatStatementSplit) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}

func (formatStatementSplit) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil {
    return
  }
  layout := loadFormatLayout(ctx)
  src := ctx.File.Text()
  var edits []TextEdit
  forEachStatementInList(ctx.File, func(stmt *shimast.Node, depth int) {
    start := shimscanner.SkipTrivia(src, stmt.Pos())
    if start <= 0 || start > len(src) {
      return
    }
    // Walk back over the whitespace run that precedes the statement.
    ws := start
    for ws > 0 && (src[ws-1] == ' ' || src[ws-1] == '\t') {
      ws--
    }
    if ws == 0 || src[ws-1] == '\n' {
      // First non-whitespace byte on its line already; that is
      // `format/indent`'s job, not this rule's.
      return
    }
    // The gap between the previous statement and this one must be pure
    // whitespace. A `//` or `/*` in `[ws, start)` would be eaten by the
    // replacement, so abstain.
    if gapHasComment(src, ws, start) {
      return
    }
    edits = append(edits, TextEdit{
      Pos:  ws,
      End:  start,
      Text: layout.eol + layout.indent(depth),
    })
  })
  if len(edits) == 0 {
    return
  }
  ctx.ReportRangeFix(
    edits[0].Pos,
    edits[0].End,
    "Each statement must begin on its own line.",
    edits...,
  )
}

// gapHasComment reports whether the byte range [start, end) contains the
// opening bytes of a `//` or `/*` comment. The split rule abstains when
// the inter-statement gap carries a comment so its line-break insertion
// never deletes the comment.
func gapHasComment(src string, start, end int) bool {
  for i := start; i+1 < end && i+1 < len(src); i++ {
    if src[i] == '/' && (src[i+1] == '/' || src[i+1] == '*') {
      return true
    }
  }
  return false
}

// formatLayout is the resolved indentation + EOL snapshot the structural
// format rules share. Defaults match Prettier: 2-space indent, spaces
// (not tabs), LF newlines.
type formatLayout struct {
  tabWidth int
  useTabs  bool
  eol      string
}

// indent returns the indentation string for `depth` nesting levels:
// `depth` tab characters when useTabs, otherwise `depth * tabWidth`
// spaces.
func (l formatLayout) indent(depth int) string {
  if depth <= 0 {
    return ""
  }
  if l.useTabs {
    return strings.Repeat("\t", depth)
  }
  return strings.Repeat(" ", depth*l.tabWidth)
}

// loadFormatLayout decodes the shared tabWidth/useTabs/endOfLine options
// used by `format/statement-split` and `format/indent` and applies the
// Prettier defaults. Both rules carry the identical option struct shape,
// so the decode is funneled through the statement-split option struct.
func loadFormatLayout(ctx *Context) formatLayout {
  var opts formatStatementSplitOptions
  _ = ctx.DecodeOptions(&opts)
  layout := formatLayout{tabWidth: 2, useTabs: false, eol: "\n"}
  if opts.TabWidth != nil && *opts.TabWidth > 0 {
    layout.tabWidth = *opts.TabWidth
  }
  if opts.UseTabs != nil {
    layout.useTabs = *opts.UseTabs
  }
  if opts.EndOfLine != nil && *opts.EndOfLine == "crlf" {
    layout.eol = "\r\n"
  }
  return layout
}

// forEachStatementInList walks the file's AST and invokes `fn` once for
// every statement that lives directly inside a statement list — the
// SourceFile body, a Block, a ModuleBlock, or a case/default clause.
// `depth` is the nesting level used to compute indentation: one level
// per enclosing Block or ModuleBlock plus one per enclosing case/default
// clause. Top-level statements are depth 0.
//
// The SourceFile body's statements are visited at depth 0, then the walk
// recurses through the whole subtree via `ForEachChild`, bumping the
// depth on each statement-list owner it descends into. The rule's
// KindSourceFile registration therefore sees every nested statement
// without the engine dispatching one node kind at a time.
func forEachStatementInList(file *shimast.SourceFile, fn func(stmt *shimast.Node, depth int)) {
  if file == nil || file.Statements == nil {
    return
  }
  for _, stmt := range file.Statements.Nodes {
    if stmt == nil {
      continue
    }
    fn(stmt, 0)
  }
  walkStatementLists(file.AsNode(), 0, fn)
}

// walkStatementLists recurses through `node`'s children. When it
// descends into a statement-list owner (Block, ModuleBlock, case/default
// clause) it bumps `depth` and invokes `fn` for each statement that
// owner directly holds, so a statement is always reported at the depth
// of the list it belongs to. The SourceFile body is visited by the
// caller, so this function only handles the nested owners.
func walkStatementLists(node *shimast.Node, depth int, fn func(stmt *shimast.Node, depth int)) {
  if node == nil {
    return
  }
  node.ForEachChild(func(child *shimast.Node) bool {
    if child == nil {
      return false
    }
    childDepth := depth
    switch child.Kind {
    case shimast.KindBlock, shimast.KindModuleBlock:
      childDepth = depth + 1
      for _, stmt := range child.Statements() {
        if stmt == nil {
          continue
        }
        fn(stmt, childDepth)
      }
    case shimast.KindCaseClause, shimast.KindDefaultClause:
      childDepth = depth + 1
      clause := child.AsCaseOrDefaultClause()
      if clause != nil && clause.Statements != nil {
        for _, stmt := range clause.Statements.Nodes {
          if stmt == nil {
            continue
          }
          fn(stmt, childDepth)
        }
      }
    }
    walkStatementLists(child, childDepth, fn)
    return false
  })
}

func init() {
  Register(formatStatementSplit{})
}
