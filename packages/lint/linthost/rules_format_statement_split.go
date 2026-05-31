package linthost

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// formatStatementSplit puts every statement in a statement list on its
// own physical line, mirroring Prettier's "one statement per line"
// layout. Prettier never leaves two statements sharing a source line,
// `const a = 1; let b = 2;` becomes two lines, and this rule is the
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
//     statement already starts its own line, abstain (that is
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
    // Empty statements (`;`) carry no content. Splitting each one onto
    // its own line only multiplies blank-ish noise, so abstain.
    if stmt.Kind == shimast.KindEmptyStatement {
      return
    }
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
    // Do not split a statement off a leading-semicolon ASI guard
    // (`;(expr)`): the lone `;` before it is an empty-statement guard
    // that format/orphan-semi intentionally merged onto this line, and
    // re-splitting it would oscillate against that rule. The `;` is a
    // guard (not a terminator like `foo();bar()`) when only whitespace
    // precedes it back to the start of its line.
    if src[ws-1] == ';' {
      k := ws - 1
      for k > 0 && (src[k-1] == ' ' || src[k-1] == '\t') {
        k--
      }
      if k == 0 || src[k-1] == '\n' {
        return
      }
    }
    // A block that opens right after its own `case`/`default` label
    // (`case 2: {`) is not sharing a line with a preceding statement;
    // the only thing before it is the clause label, and Prettier keeps
    // the brace on the label line. Abstain so the rule does not break
    // the block off into `case 2:\n{`.
    if stmt.Kind == shimast.KindBlock && firstStatementAfterCaseLabel(stmt) {
      return
    }
    // The gap between the previous statement and this one must be pure
    // whitespace. A `//` or `/*` anywhere from the previous statement's
    // end to this one would be eaten by the replacement, so abstain. The
    // scan starts at the previous statement boundary, not at `ws`: a
    // comment is non-whitespace, so a scan that begins at `ws` (the end
    // of the immediate whitespace run) can never see it.
    if gapHasComment(src, prevStatementEnd(src, ws), start) {
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
  if start < 0 {
    start = 0
  }
  for i := start; i+1 < end && i+1 < len(src); i++ {
    if src[i] == '/' && (src[i+1] == '/' || src[i+1] == '*') {
      return true
    }
  }
  return false
}

// prevStatementEnd returns the offset where the content preceding `stmt`
// on its line ends, used as the lower bound of the inter-statement gap
// scanned for comments. It locates `stmt` in its parent statement list
// and returns the previous sibling's end; for the first statement of a
// list it returns the parent owner's start (the `{`/`case:` boundary).
// The fallback walks back from `floor` to the previous non-whitespace
// byte so a comment-free caller still gets a sane lower bound.
func prevStatementEnd(src string, floor int) int {
  // floor sits just past the whitespace run before the statement, i.e.
  // immediately after the previous content's last byte. Walking back one
  // byte lands inside that content; the gap to scan is everything from
  // the start of the current line up to floor, but a comment belongs to
  // this gap only when it follows the previous statement's terminator on
  // the same line. Scanning from the line start would also catch a
  // comment that belongs to an earlier statement, so bound the scan at
  // the nearest preceding statement terminator (`;`, `}`) or label
  // (`:`), or the line start, whichever comes first.
  i := floor - 1
  for i >= 0 {
    c := src[i]
    if c == '\n' {
      return i + 1
    }
    if c == ';' || c == '}' || c == '{' || c == ':' {
      return i + 1
    }
    i--
  }
  return 0
}

// firstStatementAfterCaseLabel reports whether `stmt` is the first
// statement of a `case`/`default` clause. Such a statement follows only
// the clause label on its line, not a preceding statement, so the split
// rule must not break a block off its label (`case 2: {` stays intact).
func firstStatementAfterCaseLabel(stmt *shimast.Node) bool {
  if stmt == nil || stmt.Parent == nil {
    return false
  }
  parent := stmt.Parent
  if parent.Kind != shimast.KindCaseClause && parent.Kind != shimast.KindDefaultClause {
    return false
  }
  clause := parent.AsCaseOrDefaultClause()
  if clause == nil || clause.Statements == nil || len(clause.Statements.Nodes) == 0 {
    return false
  }
  return clause.Statements.Nodes[0] == stmt
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
// every statement that lives directly inside a statement list, the
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
  walkStatementLists(file.AsNode(), file.Text(), 0, fn)
}

// blockStartsOwnLine reports whether a brace block opens on its own line, the
// `{` being the first non-whitespace byte of its physical line. A case/default
// body block written as `case X: {` shares the label's line (false); one
// written as `case X:` then `{` on the next line starts its own line (true).
// Prettier indents the former like a braceless `case X: stmt` (no extra level)
// but the latter like an ordinary nested block (one level deeper).
func blockStartsOwnLine(src string, block *shimast.Node) bool {
  if block == nil {
    return false
  }
  pos := shimscanner.SkipTrivia(src, block.Pos())
  if pos < 0 || pos > len(src) {
    return false
  }
  lineStart := lineStartOffset(src, pos)
  for i := lineStart; i < pos; i++ {
    if src[i] != ' ' && src[i] != '\t' {
      return false
    }
  }
  return true
}

// walkStatementLists recurses through `node`'s children. When it
// descends into a statement-list owner (Block, ModuleBlock, case/default
// clause) it bumps `depth` and invokes `fn` for each statement that
// owner directly holds, so a statement is always reported at the depth
// of the list it belongs to. The SourceFile body is visited by the
// caller, so this function only handles the nested owners.
//
// Some nodes are descend-only +1 frames: they are not statement lists
// themselves but their child statement lists nest one column deeper than
// the node. Two cases need this:
//
//   - KindCaseBlock wraps a switch's clauses
//     (SwitchStatement -> CaseBlock -> CaseClause -> statements). The
//     braces sit one level under `switch`, and the clause body sits one
//     level under `case:`, so a case-body statement is switchDepth+2.
//     The clause's own +1 stacks on top of the CaseBlock's +1.
//   - A class/interface/object-type-literal/object-literal body is not a
//     statement list, but a member's method/constructor Block nests
//     inside it. Without counting the body frame a method-body statement
//     would land one column short (the member Block's +1 only), so
//     already-correct 4-space class bodies would be rewritten to 2.
func walkStatementLists(node *shimast.Node, src string, depth int, fn func(stmt *shimast.Node, depth int)) {
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
      // A same-line `case X: { stmt }` block does not add an indent level:
      // Prettier indents it exactly like a braceless `case X: stmt`, the
      // clause having already contributed the level. A block written on its
      // OWN line under the clause (`case X:` then `{` on the next line) is an
      // ordinary nested block and keeps its extra level, so only collapse the
      // same-line form.
      if child.Kind == shimast.KindBlock && child.Parent != nil &&
        (child.Parent.Kind == shimast.KindCaseClause ||
          child.Parent.Kind == shimast.KindDefaultClause) &&
        !blockStartsOwnLine(src, child) {
        childDepth = depth
      }
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
    case shimast.KindCaseBlock,
      shimast.KindClassDeclaration,
      shimast.KindClassExpression,
      shimast.KindInterfaceDeclaration,
      shimast.KindTypeLiteral,
      shimast.KindObjectLiteralExpression:
      // Descend-only +1 frame: not a visited statement list, but its
      // nested statement lists sit one column deeper.
      childDepth = depth + 1
    }
    walkStatementLists(child, src, childDepth, fn)
    return false
  })
}

func init() {
  Register(formatStatementSplit{})
}
