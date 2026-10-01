package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
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
//
// Interface, type-literal, and class members do not take the statement
// path. Both directions route through member-specific code
// (stripMemberSemicolon, insertMemberSemicolon) that reads the written
// line structure and the list's own wrap rather than the member kind,
// because Prettier prints a member's `;` between two members in either
// layout and after the last one only where the list breaks.
//
// That makes this rule the owner of a type member's SEPARATOR, not just
// of a terminator, and the whole member surface follows from one rule
// measured against pinned Prettier 3.8.3. Prettier prints an interface or
// type-literal separator as `ifBreak(semi, ";")` and its trailing one
// inside a further `ifBreak`, which resolves to two answers:
//
//   - BETWEEN two members: `;` whenever `semi` is on OR the list is laid
//     out flat, because the flat branch of that `ifBreak` is a literal
//     `";"` whatever `semi` says.
//   - AFTER the last member: `;` only when `semi` is on AND the list
//     breaks; nothing in all three other combinations.
//
// Two consequences follow that would otherwise have to be inferred.
//
// A `,` is the same separator spelled the other way. TypeScript accepts
// either in a type member list and the parser folds either into the
// member, so both answers above apply to it unchanged. Every separator
// Prettier keeps it spells `;`, in both layouts and both modes, so a `,`
// this rule does not drop it normalizes rather than leaves as written.
// That is a separator normalization, not a terminator insert, and neither
// direction needs a line-structure test to make it.
//
// A type member of a body still written on one line is never terminated,
// so `interface D { (a: number): void }` keeps its bare call signature.
// Prettier reaches its own terminator by breaking the body first, and
// breaking it is format/indent's decision, which today covers property,
// method, and index signatures but not a call or construct signature.
// Terminating a one-line member here instead would be a layout decision
// this rule does not own, and would emit a shape Prettier never does.
//
// A mapped type is neither a statement nor a member list; it takes its own
// path in mappedTypeSemicolon.
type formatSemi struct{ optionsRule }

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
    // Interface / type-literal members, plus the class-member spellings
    // the accessor and index-signature kinds share. Prettier's `;` here
    // is a separator between two members and a trailing terminator only
    // where the list breaks; see stripMemberSemicolon and
    // insertMemberSemicolon for the per-direction rules.
    shimast.KindPropertySignature,
    shimast.KindMethodSignature,
    shimast.KindIndexSignature,
    shimast.KindCallSignature,
    shimast.KindConstructSignature,
    shimast.KindGetAccessor,
    shimast.KindSetAccessor,
    // A mapped type spells its whole body as one clause instead of a
    // member list, so no member node exists to carry its terminator and
    // the kind itself has to be visited; see mappedTypeSemicolon.
    shimast.KindMappedType,
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
  if node.Kind == shimast.KindMappedType {
    mappedTypeSemicolon(ctx, src, node, preferNever)
    return
  }
  // Interface / type-literal members and class fields carry their own
  // ASI rules, distinct from top-level statements, so each direction
  // routes through a dedicated member path. A class field keeps its
  // existing always-direction insertion by falling through to the
  // statement branch below: its body always breaks in Prettier, so it
  // needs no line-structure test.
  isClassField := node.Kind == shimast.KindPropertyDeclaration
  isTypeMember := isTypeMemberKind(node.Kind)
  if preferNever && (isClassField || isTypeMember) {
    stripMemberSemicolon(ctx, src, node, isClassField)
    return
  }
  if isTypeMember {
    insertMemberSemicolon(ctx, src, node, end)
    return
  }
  hasSemi := src[end-1] == ';'
  if preferNever {
    if !hasSemi {
      return
    }
    if !preferNeverSafeKind(node.Kind) {
      // Dropping the `;` after a class field or a type alias can
      // change parse, e.g. `class A { x: number; [k](): void {} }`
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
  // itself is a zero-width insertion at node.End(), keeping the edit
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

// nextStatementHasASIHazard reports whether removing the trailing `;`
// at `end-1` could change the parse, judged by the next significant
// byte after `end` and the line structure between them.
//
// ASI only inserts a semicolon at a line terminator, end of input, or
// before `}`. So the `;` is removable in exactly two shapes:
//
//   - end of input or a same-line `}` follows (ASI's closing-brace and
//     end-of-input rules apply), or
//   - a line terminator separates the statement from the next token AND
//     that token is not a continuation hazard.
//
// Any other same-line successor (`else`, `while` of a do-loop, another
// statement after a gap comment) makes the `;` a REQUIRED separator:
// no line terminator means ASI cannot fire, so stripping would be a
// syntax error, not a style change.
//
// Hazard tokens per the ASI spec:
//
//   - `[`: bracket access continues an expression
//   - `(`: call expression continues
//   - “ ` “: tagged template literal continues
//   - `+`, `-`, `*`: binary operator continues
//   - `,`: comma operator continues
//   - `/`: division operator or regex literal continues (a leading `//`
//     or `/*` is trivia consumed by scanPastTrivia; a bare `/` is a
//     hazard).
func nextStatementHasASIHazard(src string, end int) bool {
  i, sawNewline := scanPastTrivia(src, end)
  if i >= len(src) {
    return false
  }
  c := src[i]
  if c == '}' {
    // ASI applies before a closing brace regardless of line
    // structure: `{ a(); }` → `{ a() }` stays valid.
    return false
  }
  if !sawNewline {
    // Next token on the same line: ASI cannot fire without a line
    // terminator, so the `;` separates the two constructs
    // (`if (a) b(); else c();`, `do f(); while (x);`,
    // `a = 1; /* note */ b = 2`). Keep it.
    return true
  }
  if c == '/' {
    // bare `/` starts a regex literal or division, hazard.
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

// scanPastTrivia advances from `pos` past whitespace and comments,
// returning the index of the next significant byte (len(src) at end of
// input) and whether a line terminator was crossed on the way. Both
// semicolon scanners (statement and member) share it so the ASI line
// rules cannot drift apart.
//
// A block comment that spans lines counts as a crossed line: per
// ECMA-262 (Comments), a multi-line comment containing a line
// terminator is treated as a line terminator for ASI, so the decision
// keys on comment content, not comment kind. `\r` counts as a line
// terminator on its own, which also covers CRLF sources.
func scanPastTrivia(src string, pos int) (next int, sawNewline bool) {
  i := pos
  for i < len(src) {
    c := src[i]
    if c == '\n' || c == '\r' {
      sawNewline = true
      i++
      continue
    }
    if c == ' ' || c == '\t' {
      i++
      continue
    }
    if c == '/' && i+1 < len(src) {
      if src[i+1] == '/' {
        for i < len(src) && src[i] != '\n' && src[i] != '\r' {
          i++
        }
        continue
      }
      if src[i+1] == '*' {
        i += 2
        for i+1 < len(src) && !(src[i] == '*' && src[i+1] == '/') {
          if src[i] == '\n' || src[i] == '\r' {
            sawNewline = true
          }
          i++
        }
        if i+1 < len(src) {
          i += 2 // step past '*/'
        } else {
          i = len(src) // unterminated block comment swallows the rest
        }
        continue
      }
    }
    return i, sawNewline
  }
  return len(src), sawNewline
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
// object-type-literal member: the kinds whose trailing `;` Prettier
// strips under semi:false and inserts under semi:true.
//
// All seven take the same answer in both directions, which is measured
// rather than assumed from symmetry. The `format/semi` conformance cases
// run a property, method, index, call, and construct signature plus both
// accessors through pinned Prettier 3.8.3, and every one of them comes
// back terminated once its body is broken across lines.
// GetAccessor and SetAccessor also spell a class or object-literal
// accessor, which is not a type member at all; the context test in
// memberTakesSemicolonTerminator, not this predicate, separates those.
//
// Class fields (KindPropertyDeclaration) are handled separately because
// their initializer is an expression and so they carry the full
// expression-ASI hazard set, while type members only risk a
// call/construct-signature (`(`) or generic-call-signature (`<`)
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

// stripMemberSemicolon settles the separator of an interface /
// type-literal member or a class field under semi:false.
//
// Two outcomes are possible, because semi:false silences only the
// separators Prettier itself would omit. A separator the oracle drops is
// removed; a separator it keeps is spelled `;`, so a `,` that survives is
// normalized instead of left as written. A `;` that survives is already
// in that spelling and produces no finding, which is also the
// idempotency guard: once removed there is nothing left to act on, and
// once normalized the `;` is what the next pass reads.
//
// See findMemberSeparator for how the byte is located and
// memberSemicolonRedundant for the drop decision.
func stripMemberSemicolon(ctx *Context, src string, node *shimast.Node, isClassField bool) {
  sepPos := findMemberSeparator(src, node, isClassField)
  if sepPos < 0 {
    return
  }
  if memberSemicolonRedundant(src, node, sepPos+1, isClassField) {
    message := "Unexpected trailing semicolon."
    if src[sepPos] == ',' {
      message = "Unexpected member separator."
    }
    ctx.ReportRangeFix(
      sepPos,
      sepPos+1,
      message,
      TextEdit{Pos: sepPos, End: sepPos + 1, Text: ""},
    )
    return
  }
  if src[sepPos] != ',' {
    return
  }
  reportMemberSeparatorNormalization(ctx, sepPos)
}

// findMemberSeparator returns the offset of the separator byte that closes
// `node`, or -1 when the member carries none.
//
// The byte is located robustly. typescript-go consumes it as a separate
// token before closing the node (parseTypeMemberSemicolon and
// parseSemicolonAfterPropertyName both run ahead of finishNode), so End()
// normally sits just past it; an error-recovery path that returns without
// consuming leaves it outside instead. Accept either a separator already
// at End()-1 or the first one reached scanning horizontal whitespace
// forward from End().
//
// A `,` counts only where Prettier would print a `;`, which is what
// memberTakesSemicolonTerminator answers. The exclusion is not cosmetic:
// an object literal's accessor arrives here as the same GetAccessor /
// SetAccessor kind, its body's `}` leaves the following `,` sitting right
// where this scan looks, and removing or rewriting that comma would
// corrupt the literal. A class field is excluded for the same reason from
// the other side: `,` is not a class-member separator at all, so one found
// next to a field belongs to some recovered parse.
func findMemberSeparator(src string, node *shimast.Node, isClassField bool) int {
  commaCounts := !isClassField && memberTakesSemicolonTerminator(node)
  matches := func(i int) bool {
    if i < 0 || i >= len(src) {
      return false
    }
    return src[i] == ';' || (commaCounts && src[i] == ',')
  }
  end := node.End()
  if matches(end - 1) {
    return end - 1
  }
  i := end
  for i < len(src) && (src[i] == ' ' || src[i] == '\t') {
    i++
  }
  if matches(i) {
    return i
  }
  return -1
}

// memberSemicolonRedundant reports whether the member separator whose
// following byte is at `after` can be dropped without changing the parse.
// It scans past trivia (whitespace + comments, via scanPastTrivia) to the
// next significant byte and applies Prettier's semi:false member rules:
//
//   - The closing `}` (or end of file) always makes the separator
//     redundant: the trailing one is printed inside an `ifBreak` that
//     resolves to nothing under semi:false, in either layout.
//   - A next member on the SAME line (no newline crossed) keeps the
//     separator, the rule never inserts the newline that would let ASI
//     take over, so dropping it here would corrupt the source.
//   - A next member in a list Prettier lays out FLAT keeps it too. Between
//     two members the separator is `ifBreak(semi, ";")`, whose flat branch
//     is `";"` whatever `semi` says, so only the trailing one is silenced
//     by semi:false in a flat list. memberListBreaks is the same question
//     insertMemberSemicolon asks from the other end.
//   - A newline-separated next member in a broken list drops the separator
//     unless its lead token would re-associate with the prior member: the
//     full expression-ASI hazard set for class fields (`[ ( ` + - * / ,`),
//     or just a call/construct/generic signature (`(` / `<`) for type
//     members (a leading `[` is an index signature there, not a
//     continuation). Prettier defends the same shapes, printing
//     `a: number;` ahead of a call signature even under semi:false.
func memberSemicolonRedundant(src string, node *shimast.Node, after int, isClassField bool) bool {
  i, sawNewline := scanPastTrivia(src, after)
  if i >= len(src) {
    return true
  }
  c := src[i]
  if c == '}' {
    return true
  }
  if !sawNewline {
    return false
  }
  if !memberListBreaks(src, node.Parent) {
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

// reportMemberSeparatorNormalization rewrites the `,` at `pos` to the `;`
// Prettier spells every type-member separator it keeps. Both directions
// share it so the two cannot drift into different spellings.
func reportMemberSeparatorNormalization(ctx *Context, pos int) {
  ctx.ReportRangeFix(
    pos,
    pos+1,
    "Normalize the member separator to a semicolon.",
    TextEdit{Pos: pos, End: pos + 1, Text: ";"},
  )
}

// insertMemberSemicolon appends the `;` Prettier prints after an
// interface, type-literal, or class member that ends its physical line.
//
// A member's `;` plays two roles in Prettier's object printer, and the
// insert answers them separately:
//
//   - BETWEEN two members it is a separator, printed in both layouts. So
//     a member with another member below it takes the `;` whether or not
//     the list ends up broken.
//   - AFTER the last member it is a trailing terminator, printed inside
//     an `ifBreak` and therefore only when the list breaks. That is why
//     `type T = { a: number }` is Prettier's own output for that input,
//     and why memberListBreaks decides this case rather than the line
//     structure at the member itself.
//
// Both roles need the member to end its line: a `;` the author did not
// write between two same-line members is one Prettier would print only
// after inserting the line break this rule never inserts.
//
// memberSemicolonRedundant reads the same oracle rule from the other end,
// which is why the two are complementary rather than opposite: a `;`
// before a same-line `}` closes a flat list, where Prettier prints no
// trailing separator at all, so the strip drops it and this never adds
// one back.
//
// The edit is a zero-width insertion at the member's End(), so it stays
// disjoint from the format/statement-split, format/indent, and
// format/print-width edits that may land on the same lines; the applier
// keeps one finding per contested range, so an overlap would cost a whole
// cascade pass. It cannot change the parse either: the parser already
// ended the member at that offset (parseTypeMemberSemicolon runs before
// finishNode), so the inserted `;` only spells out a boundary the parse
// had already made.
//
// Idempotent: a re-parse folds the inserted `;` into the member's range,
// so the next pass reads it at End()-1 and abstains.
func insertMemberSemicolon(ctx *Context, src string, node *shimast.Node, end int) {
  if !memberTakesSemicolonTerminator(node) {
    return
  }
  switch src[end-1] {
  case ';':
    // Already terminated. Also the idempotency guard.
    return
  case ',':
    // The same separator spelled the other way, so this is a separator
    // normalization rather than a terminator insert, and appending would
    // emit `a: number,;`. It needs neither the line-structure test below
    // nor memberListBreaks: under semi:"always" Prettier prints `;` for a
    // separator in both layouts, so no layout knowledge is required to
    // pick the spelling. The one case the oracle answers differently is a
    // trailing `,` in a flat list, which it drops outright; this direction
    // drops nothing, and it already leaves a written `;` standing in that
    // same position, so normalizing lands on the shape it tolerates.
    reportMemberSeparatorNormalization(ctx, end-1)
    return
  }
  // Trivia is crossed with scanPastTrivia, so a trailing line comment and
  // a block comment carrying a line terminator both count as the break
  // ECMA-262 says they are, and both member scanners keep one notion of
  // "a line was crossed". Reaching end of input means the body has no
  // closing `}`; that source is too broken to reason about, so abstain.
  next, sawNewline := scanPastTrivia(src, end)
  if next >= len(src) || !sawNewline {
    return
  }
  // The list's `}` is the only thing that can follow the last member, so
  // this is the trailing-terminator case and the list has to be one
  // Prettier breaks.
  if src[next] == '}' && !memberListBreaks(src, node.Parent) {
    return
  }
  // Anchored on the member's last character for the same reason the
  // statement branch is: the banner underlines "the place a semicolon
  // should follow", while the fix stays zero-width at End().
  ctx.ReportRangeFix(
    end-1,
    end,
    "Missing semicolon.",
    TextEdit{Pos: end, End: end, Text: ";"},
  )
}

// memberTakesSemicolonTerminator reports whether Prettier terminates
// `node` with a `;` at all. It decides on the member's own shape and on
// the member list holding it, not on its kind, because one kind spells
// members of both a `;`-separated and a `,`-separated list:
//
//   - A member carrying a body ends in `}`, and Prettier never follows a
//     braced member with a terminator. The reachable case is an accessor:
//     GetAccessor and SetAccessor spell both a bodiless interface
//     accessor and a class accessor with a body.
//   - Interface and type-literal bodies are `;`-separated. So is a class
//     body, whose index signatures and bodiless (`declare` / `abstract`)
//     accessors take the same terminator as their type-member spellings,
//     and are broken onto their own lines by the same format/indent pass.
//   - An object literal is `,`-separated. Its accessors arrive here as
//     the same two kinds, and a `;` after one is a syntax error.
func memberTakesSemicolonTerminator(node *shimast.Node) bool {
  if node.Body() != nil {
    return false
  }
  parent := node.Parent
  if parent == nil {
    return false
  }
  switch parent.Kind {
  case shimast.KindInterfaceDeclaration,
    shimast.KindTypeLiteral,
    shimast.KindClassDeclaration,
    shimast.KindClassExpression:
    return true
  }
  return false
}

// memberListBreaks reports whether Prettier lays `owner`'s braced body out
// across lines. Both directions ask it, and both ask about a separator
// whose presence is conditional on the wrap: the trailing terminator
// Prettier prints inside an `ifBreak`, and (under semi:false) the
// separator between two members, whose flat branch is a literal `";"`.
//
// `owner` is a member's parent, or a mapped type itself. An interface body
// and a class body always break once they hold a member, so the source's
// own line structure does not enter into it.
//
// An object type is the exception, and a mapped type is decided the same
// way: both preserve the author's wrap (Prettier's
// `objectWrap: "preserve"`), breaking when a line terminator separates the
// `{` from what follows it and otherwise staying on one line however the
// source placed the closing `}`. Prettier 3.8.3 returns
// `type T = { a: number\n};` as the one-line `type T = { a: number };` and
// `type M = { [K in string]: string\n};` as `type M = { [K in string]: string };`,
// both with nothing before the brace, so reading where the `}` landed would
// insert a `;` the oracle never prints.
//
// The width half of Prettier's break decision (a flat body that overflows
// its budget breaks) is deliberately absent: no ttsc pass reflows an
// object or mapped type, so a flat one stays flat and a trailing
// terminator would be one this formatter's own output never justifies. A
// pass that ever breaks them writes the line terminator this reads.
func memberListBreaks(src string, owner *shimast.Node) bool {
  if owner == nil {
    return false
  }
  switch owner.Kind {
  case shimast.KindTypeLiteral, shimast.KindMappedType:
  default:
    return true
  }
  open := shimscanner.SkipTrivia(src, owner.Pos())
  if open < 0 || open >= len(src) || src[open] != '{' {
    // Not the shape this reads. Keep the author's bytes.
    return false
  }
  _, sawNewline := scanPastTrivia(src, open+1)
  return sawNewline
}

// mappedTypeSemicolon settles the `;` Prettier prints after a mapped
// type's clause.
//
// A mapped type is not a member list. `{ readonly [K in T as N]?: V }`
// holds one clause, typescript-go hangs its parts off the MappedTypeNode
// itself, and parseMappedType consumes the optional `;` with
// parseSemicolon before finishNode, so no child's range covers it and no
// member node exists to carry one. Every position is therefore the
// trailing-terminator position, which Prettier prints as
// `options.semi ? ifBreak(";") : ""`: present exactly when `semi` is on
// and the mapped type is one it breaks, absent in every other
// combination. The `readonly` / `?` modifiers and their `+` and `-`
// variants do not change that answer, measured rather than assumed.
//
// memberListBreaks reads the mapped type's own braces because Prettier
// decides its wrap the way it decides an object type's. That is also why,
// unlike insertMemberSemicolon, this needs no "ends its line" test: a
// member list needs a break before Prettier will print a separator
// between two same-line members, while a lone terminator needs only the
// wrap the `{` already decided. Prettier 3.8.3 terminates
// `type M = {\n  [K in string]: string };` and leaves
// `type M = { [K in string]: string\n};` bare.
//
// Idempotent in both directions: the inserted `;` is what the next pass
// finds ahead of the `}` and abstains on, and the stripped one leaves the
// `}` the strip abstains on.
func mappedTypeSemicolon(ctx *Context, src string, node *shimast.Node, preferNever bool) {
  clauseEnd := mappedTypeClauseEnd(src, node)
  if clauseEnd <= 0 {
    return
  }
  next, _ := scanPastTrivia(src, clauseEnd)
  if next >= len(src) || next >= node.End() {
    // No closing `}` in range. That source is too broken to reason about.
    return
  }
  if src[next] == ';' {
    if !preferNever {
      return // already terminated, and the always direction never strips
    }
    ctx.ReportRangeFix(
      next,
      next+1,
      "Unexpected trailing semicolon.",
      TextEdit{Pos: next, End: next + 1, Text: ""},
    )
    return
  }
  if preferNever || src[next] != '}' || !memberListBreaks(src, node) {
    return
  }
  pos := mappedTypeTerminatorPos(src, clauseEnd)
  ctx.ReportRangeFix(
    pos-1,
    pos,
    "Missing semicolon.",
    TextEdit{Pos: pos, End: pos, Text: ";"},
  )
}

// mappedTypeClauseEnd returns the offset just past the last significant
// byte of a mapped type's clause, or -1 when the node is not the shape
// this reads.
//
// With a type annotation the clause simply ends where that type does. The
// annotation is optional, though, and the parser's own token nodes stop
// short of the trailing punctuation in that case: `NameType` and
// `TypeParameter` both end before the `]`, and a `+`/`-` modifier is
// parsed as the question token with the `?` it decorates consumed by a
// bare parseExpected. So the remaining shapes are reached by stepping over
// exactly the bytes that can follow a clause child, which is why the walk
// runs only when there is no annotation to end at.
//
// A non-empty Members list means the parser recovered from a second member
// inside the braces (`{ [K in T]: V; a: number }`), which is not a shape
// with a single terminator position; abstain rather than guess.
func mappedTypeClauseEnd(src string, node *shimast.Node) int {
  mapped := node.AsMappedTypeNode()
  if mapped == nil {
    return -1
  }
  if mapped.Members != nil && len(mapped.Members.Nodes) > 0 {
    return -1
  }
  if mapped.Type != nil {
    end := mapped.Type.End()
    if end <= 0 || end > len(src) {
      return -1
    }
    return end
  }
  lo := -1
  switch {
  case mapped.QuestionToken != nil:
    lo = mapped.QuestionToken.End()
  case mapped.NameType != nil:
    lo = mapped.NameType.End()
  case mapped.TypeParameter != nil:
    lo = mapped.TypeParameter.End()
  }
  if lo <= 0 || lo > len(src) {
    return -1
  }
  for {
    next, _ := scanPastTrivia(src, lo)
    if next >= len(src) {
      return -1
    }
    switch src[next] {
    case ']', '?', '+', '-':
      lo = next + 1
    default:
      return lo
    }
  }
}

// mappedTypeTerminatorPos returns the offset Prettier's mapped-type `;`
// occupies, given the clause end.
//
// It is the clause end in every ordinary shape, and the two comment cases
// are the reason it is a function rather than that offset. Prettier
// attaches a trailing block comment written on the clause's own line to
// the value type and prints the terminator after it
// (`[K in string]: string /* note */;`), while a line comment becomes the
// mapped type's dangling comment and is printed after the terminator
// (`[K in string]: string; // note`). A block comment that spans lines is
// a line terminator per ECMA-262 and ends the clause's line, so the walk
// stops there too. This is the one place a mapped type and a member
// disagree: a member takes its `;` at End(), ahead of the same block
// comment.
func mappedTypeTerminatorPos(src string, clauseEnd int) int {
  pos := clauseEnd
  i := clauseEnd
  for i < len(src) {
    for i < len(src) && (src[i] == ' ' || src[i] == '\t') {
      i++
    }
    if i+1 >= len(src) || src[i] != '/' || src[i+1] != '*' {
      return pos
    }
    j := i + 2
    for j+1 < len(src) && !(src[j] == '*' && src[j+1] == '/') {
      if src[j] == '\n' || src[j] == '\r' {
        return pos
      }
      j++
    }
    if j+1 >= len(src) {
      return pos // unterminated block comment swallows the rest
    }
    i = j + 2
    pos = i
  }
  return pos
}

func init() {
  Register(formatSemi{})
}
