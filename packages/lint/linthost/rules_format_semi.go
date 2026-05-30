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
    // Interface / type-literal members. Prettier drops their trailing
    // `;` under semi:false when they are newline-separated; see
    // stripMemberSemicolon for the per-context hazard rules.
    shimast.KindPropertySignature,
    shimast.KindMethodSignature,
    shimast.KindIndexSignature,
    shimast.KindCallSignature,
    shimast.KindConstructSignature,
    shimast.KindGetAccessor,
    shimast.KindSetAccessor,
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
  // Interface / type-literal members and class fields carry their own
  // ASI rules, distinct from top-level statements, so the never
  // direction routes through a dedicated stripper. Class fields keep
  // their existing always-direction insertion (falling through below);
  // inserting a missing interface/type member terminator is out of scope
  // for this strip fix, so type members short-circuit in always mode.
  isClassField := node.Kind == shimast.KindPropertyDeclaration
  isTypeMember := isTypeMemberKind(node.Kind)
  if preferNever && (isClassField || isTypeMember) {
    stripMemberSemicolon(ctx, src, node, isClassField)
    return
  }
  if isTypeMember {
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
//   - `+`, `-`, `*` — binary operator continues
//   - `,`  — comma operator continues
//   - `/`  — division operator or regex literal continues; handled by
//     the comment-or-regex branch below (a leading `//` or `/*` is not a
//     hazard, a bare `/` is), so it is absent from the token switch.
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
    // If the next significant byte is one of these, dropping the terminator
    // could let the following line re-associate with the prior expression.
    // `( [`, a unary `+ -`, and a tagged-template backtick are the cases
    // actually reachable from a valid statement start; `<` matters in .tsx
    // (a leading `<` opens a JSX element). The remaining infix bytes cannot
    // begin a valid statement on their own, but are listed defensively so
    // the strip always cedes rather than risk a parse-changing edit.
    case '[', '(', '`', '+', '-', '*', ',', '.', '<', '>', '=', '?', '%', '&', '|', '^':
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
    shimast.KindExportAssignment,
    // `type T = …;` is a statement-position declaration; Prettier drops
    // its terminator under semi:false. The nextStatementHasASIHazard
    // guard keeps it whenever removal would let ASI mis-associate the
    // following statement (e.g. a leading `(`/`[`).
    shimast.KindTypeAliasDeclaration:
    return true
  }
  return false
}

// isTypeMemberKind reports whether `kind` is an interface or
// object-type-literal member whose trailing `;` Prettier strips under
// semi:false. Class fields (KindPropertyDeclaration) are handled
// separately because their initializer is an expression and so they
// carry the full expression-ASI hazard set, while type members only
// risk a call/construct-signature (`(`) or generic-call-signature (`<`)
// continuation.
func isTypeMemberKind(kind shimast.Kind) bool {
  switch kind {
  case
    shimast.KindPropertySignature,
    shimast.KindMethodSignature,
    shimast.KindIndexSignature,
    shimast.KindCallSignature,
    shimast.KindConstructSignature,
    shimast.KindGetAccessor,
    shimast.KindSetAccessor:
    return true
  }
  return false
}

// stripMemberSemicolon removes a redundant trailing `;` from an
// interface / type-literal member or a class field under semi:false.
//
// The member-terminating `;` is located robustly: typescript-go parses
// the terminator as a separate token (parseTypeMemberSemicolon /
// parseSemicolonAfterPropertyName run after finishNode), so a member
// node's End() may sit before the `;`. Accept either a `;` already at
// End()-1 or the first `;` reached scanning horizontal whitespace
// forward from End().
//
// The `;` is dropped only when it is redundant — see
// memberSemicolonRedundant — so single-line separators stay intact and
// ASI-hazardous continuations keep their terminator. Idempotent: once
// removed, no `;` remains for the rule to act on.
func stripMemberSemicolon(ctx *Context, src string, node *shimast.Node, isClassField bool) {
  end := node.End()
  semiPos := -1
  if end-1 >= 0 && src[end-1] == ';' {
    semiPos = end - 1
  } else {
    i := end
    for i < len(src) && (src[i] == ' ' || src[i] == '\t') {
      i++
    }
    if i < len(src) && src[i] == ';' {
      semiPos = i
    }
  }
  if semiPos < 0 {
    return
  }
  if !memberSemicolonRedundant(src, semiPos+1, isClassField) {
    return
  }
  ctx.ReportRangeFix(
    semiPos,
    semiPos+1,
    "Unexpected trailing semicolon.",
    TextEdit{Pos: semiPos, End: semiPos + 1, Text: ""},
  )
}

// memberSemicolonRedundant reports whether the member terminator `;`
// whose following byte is at `after` can be dropped without changing the
// parse. It scans past trivia (whitespace + comments) to the next
// significant byte and applies Prettier's semi:false member rules:
//
//   - The closing `}` (or end of file) always makes the `;` redundant.
//   - A next member on the SAME line (no newline crossed) keeps the `;`
//     as a required separator — the rule never inserts the newline that
//     would let ASI take over, so dropping it here would corrupt the
//     source.
//   - A newline-separated next member drops the `;` unless its lead token
//     would re-associate with the prior member: the full expression-ASI
//     hazard set for class fields (`[ ( ` + - * / ,`), or just a
//     call/construct/generic signature (`(` / `<`) for type members
//     (a leading `[` is an index signature there, not a continuation).
func memberSemicolonRedundant(src string, after int, isClassField bool) bool {
  sawNewline := false
  for i := after; i < len(src); {
    c := src[i]
    if c == '\n' {
      sawNewline = true
      i++
      continue
    }
    if c == ' ' || c == '\t' || c == '\r' {
      i++
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
          if src[i] == '\n' {
            sawNewline = true
          }
          i++
        }
        if i+1 < len(src) {
          i += 2
        }
        continue
      }
    }
    if c == '}' {
      return true
    }
    if !sawNewline {
      return false
    }
    if isClassField {
      switch c {
      case '[', '(', '`', '+', '-', '*', '/', ',':
        return false
      }
    } else {
      switch c {
      case '(', '<':
        return false
      }
    }
    return true
  }
  return true
}

func init() {
  Register(formatSemi{})
}
