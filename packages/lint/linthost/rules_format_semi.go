package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// formatSemi controls trailing-semicolon style on ASI statements.
// Mirrors prettier's `semi` option:
//
//   - `prefer: "always"` (default) inserts a missing terminator.
//   - `prefer: "never"`  strips a trailing terminator from the same
//     statement kinds.
//
// The rule scans only statement kinds where TypeScript inserts an
// optional semicolon. Body-shaped declarations (functions, classes,
// namespaces, enums) and control-flow statements (if/for/while/try)
// are out of scope because they parse correctly without a terminator.
type formatSemi struct{}

// formatSemiOptions is the Go mirror of `TtscLintRuleOptions.Semi`. The
// JSON tag matches the TypeScript field name so users get the same key
// in both layers.
type formatSemiOptions struct {
  Prefer string `json:"prefer"`
}

func (formatSemi) Name() string   { return "format/semi" }
func (formatSemi) IsFormat() bool { return true }

func (formatSemi) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindVariableStatement,
    shimast.KindExpressionStatement,
    shimast.KindReturnStatement,
    shimast.KindThrowStatement,
    shimast.KindBreakStatement,
    shimast.KindContinueStatement,
    shimast.KindDoStatement,
    shimast.KindDebuggerStatement,
    shimast.KindImportDeclaration,
    shimast.KindImportEqualsDeclaration,
    shimast.KindExportDeclaration,
    shimast.KindExportAssignment,
    shimast.KindPropertyDeclaration,
    shimast.KindTypeAliasDeclaration,
  }
}

func (formatSemi) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil || node == nil {
    return
  }
  var opts formatSemiOptions
  _ = ctx.DecodeOptions(&opts)
  preferNever := opts.Prefer == "never"

  src := ctx.File.Text()
  end := node.End()
  if end <= 0 || end > len(src) {
    return
  }
  hasSemi := src[end-1] == ';'
  if preferNever {
    if !hasSemi {
      return
    }
    if !preferNeverSafeKind(node.Kind) {
      // Dropping the `;` after a class field or a type alias can
      // change parse — e.g. `class A { x: number; [k](): void {} }`
      // would reparse `[k]` as a computed index access on `number`.
      // Keep the terminator on those kinds even in prefer:"never"
      // mode.
      return
    }
    if nextStatementHasASIHazard(src, end) {
      // Stripping `;` here would let ASI fail. Prettier defends with a
      // leading-`;` on the next statement; this rule conservatively
      // refuses to strip rather than synthesizing an edit on a node
      // it didn't visit.
      return
    }
    pos := end - 1
    if pos < 0 {
      pos = 0
    }
    ctx.ReportRangeFix(
      pos,
      end,
      "Unexpected trailing semicolon.",
      TextEdit{Pos: end - 1, End: end, Text: ""},
    )
    return
  }
  if hasSemi {
    return
  }
  // Diagnostic anchors on the last character of the statement so the
  // banner underlines "the place a semicolon should follow". The fix
  // itself is a zero-width insertion at node.End() — keeping the edit
  // disjoint from any other rule's edits on the same statement.
  pos := end - 1
  if pos < 0 {
    pos = 0
  }
  ctx.ReportRangeFix(
    pos,
    end,
    "Missing semicolon.",
    TextEdit{Pos: end, End: end, Text: ";"},
  )
}

// nextStatementHasASIHazard reports whether the next non-trivia byte
// after `end` starts a token that would re-associate with the prior
// expression if the trailing `;` is removed. Prettier handles this by
// inserting a defensive leading `;` on the next line; this rule's
// fixer is single-node, so the safer move is to keep the explicit
// terminator.
//
// Hazard tokens per the ASI spec:
//
//   - `[`  — bracket access continues an expression
//   - `(`  — call expression continues
//   - “ ` “ — tagged template literal continues
//   - `+`, `-`, `*`, `/` — binary operator continues
//   - `,`  — comma operator continues
func nextStatementHasASIHazard(src string, end int) bool {
  for i := end; i < len(src); i++ {
    c := src[i]
    if c == ' ' || c == '\t' || c == '\r' || c == '\n' {
      continue
    }
    if c == '/' && i+1 < len(src) {
      if src[i+1] == '/' {
        for i < len(src) && src[i] != '\n' {
          i++
        }
        continue
      }
      if src[i+1] == '*' {
        i += 2
        for i+1 < len(src) && !(src[i] == '*' && src[i+1] == '/') {
          i++
        }
        if i+1 < len(src) {
          i++ // step past '*/'
        }
        continue
      }
      // bare `/` starts a regex literal or division — hazard.
      return true
    }
    switch c {
    case '[', '(', '`', '+', '-', '*', ',':
      return true
    }
    return false
  }
  return false
}

// preferNeverSafeKind reports whether stripping the trailing semicolon
// is safe for `kind`. Statement kinds end at a line break or `}` in
// practice; declaration-style kinds (PropertyDeclaration,
// TypeAliasDeclaration) live next to other class/module members where
// the explicit terminator disambiguates the next token. The
// prefer:"never" branch refuses to touch those.
func preferNeverSafeKind(kind shimast.Kind) bool {
  switch kind {
  case
    shimast.KindVariableStatement,
    shimast.KindExpressionStatement,
    shimast.KindReturnStatement,
    shimast.KindThrowStatement,
    shimast.KindBreakStatement,
    shimast.KindContinueStatement,
    shimast.KindDoStatement,
    shimast.KindDebuggerStatement,
    shimast.KindImportDeclaration,
    shimast.KindImportEqualsDeclaration,
    shimast.KindExportDeclaration,
    shimast.KindExportAssignment:
    return true
  }
  return false
}

func init() {
  Register(formatSemi{})
}
