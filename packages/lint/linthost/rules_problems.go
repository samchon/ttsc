// Bulk implementation of ESLint's "Possible Problems" category.
//
// Each rule keeps to pure-AST checks (no scope analysis, no checker
// queries beyond what's already in the rule's own walk) so they remain
// fast and predictable. Rules that require scope binding or
// flow-sensitive analysis are intentionally not implemented here —
// those are upstream's job.
package linthost

import (
  "strconv"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// noDupeElseIf: `if (a) {} else if (a) {}` — the second branch is
// unreachable.
type noDupeElseIf struct{}

func (noDupeElseIf) Name() string           { return "no-dupe-else-if" }
func (noDupeElseIf) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindIfStatement} }
func (noDupeElseIf) Check(ctx *Context, node *shimast.Node) {
  // Only fire on the *outermost* if; the recursion below scans the
  // chain once.
  if parent := node.Parent; parent != nil {
    if parent.Kind == shimast.KindIfStatement {
      outer := parent.AsIfStatement()
      if outer != nil && outer.ElseStatement == node {
        return
      }
    }
  }
  seen := map[string]bool{}
  cur := node
  for cur != nil && cur.Kind == shimast.KindIfStatement {
    stmt := cur.AsIfStatement()
    if stmt == nil || stmt.Expression == nil {
      break
    }
    key := nodeText(ctx.File, stmt.Expression)
    if key != "" {
      if seen[key] {
        ctx.Report(stmt.Expression, "This branch can never execute. Its condition is a duplicate of an earlier branch.")
      } else {
        seen[key] = true
      }
    }
    cur = stmt.ElseStatement
  }
}

// noExAssign: `try { } catch (e) { e = 1; }` — reassigning the catch
// binding silently throws away the error.
type noExAssign struct{}

func (noExAssign) Name() string           { return "no-ex-assign" }
func (noExAssign) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindCatchClause} }
func (noExAssign) Check(ctx *Context, node *shimast.Node) {
  clause := node.AsCatchClause()
  if clause == nil || clause.VariableDeclaration == nil || clause.Block == nil {
    return
  }
  binding := clause.VariableDeclaration.AsVariableDeclaration()
  if binding == nil {
    return
  }
  name := identifierText(binding.Name())
  if name == "" {
    return
  }
  walkAssignments(clause.Block, name, func(target *shimast.Node) {
    ctx.Report(target, "Do not assign to the exception parameter.")
  })
}

// walkAssignments invokes `report` on every `<name> = ...` shape inside
// `root`. Used by noExAssign to scan a single catch block; the
// file-wide noFuncAssign / noClassAssign scans go through
// reportAssignmentsToDeclarations instead.
func walkAssignments(root *shimast.Node, name string, report func(*shimast.Node)) {
  if root == nil {
    return
  }
  root.ForEachChild(func(child *shimast.Node) bool {
    if child == nil {
      return false
    }
    if child.Kind == shimast.KindBinaryExpression {
      expr := child.AsBinaryExpression()
      if expr != nil && expr.OperatorToken != nil && isAssignmentOperator(expr.OperatorToken.Kind) {
        if identifierText(expr.Left) == name {
          report(expr.Left)
        }
      }
    }
    walkAssignments(child, name, report)
    return false
  })
}

// noEmptyCharacterClass: `/[]/` matches nothing.
type noEmptyCharacterClass struct{}

func (noEmptyCharacterClass) Name() string { return "no-empty-character-class" }
func (noEmptyCharacterClass) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindRegularExpressionLiteral}
}
func (noEmptyCharacterClass) Check(ctx *Context, node *shimast.Node) {
  src := nodeText(ctx.File, node)
  if hasEmptyCharClass(src) {
    ctx.Report(node, "Empty class.")
  }
}

// hasEmptyCharClass reports whether the regex source text src contains an
// empty character class (`[]` or `[^]`). Respects backslash escapes.
func hasEmptyCharClass(src string) bool {
  // Walk the regex literal source manually, respecting escapes.
  for i := 0; i < len(src); i++ {
    switch src[i] {
    case '\\':
      i++ // skip escape
    case '[':
      j := i + 1
      if j < len(src) && src[j] == '^' {
        j++
      }
      if j < len(src) && src[j] == ']' {
        return true
      }
    }
  }
  return false
}

// noMisleadingCharacterClass: `/[👍]/` — surrogate pairs in regex.
type noMisleadingCharacterClass struct{}

func (noMisleadingCharacterClass) Name() string { return "no-misleading-character-class" }
func (noMisleadingCharacterClass) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindRegularExpressionLiteral}
}
func (noMisleadingCharacterClass) Check(ctx *Context, node *shimast.Node) {
  src := nodeText(ctx.File, node)
  if regexHasSurrogatePair(src) {
    ctx.Report(node, "Unexpected surrogate pair in character class. Use the 'u' flag.")
  }
}

// regexHasSurrogatePair reports whether the regex source text src contains
// a non-BMP character (code point >= U+10000) inside a character class
// without the `u` flag. Such characters are stored as surrogate pairs in
// the source and the class will only match one half of the pair.
func regexHasSurrogatePair(src string) bool {
  // Strip the trailing flags so we don't misread the `u` flag — it
  // suppresses this rule.
  end := strings.LastIndex(src, "/")
  if end < 0 {
    return false
  }
  flags := src[end+1:]
  if strings.ContainsRune(flags, 'u') {
    return false
  }
  body := src[:end]
  in := false
  for _, r := range body {
    switch r {
    case '[':
      in = true
    case ']':
      in = false
    }
    if in && r >= 0x10000 {
      return true
    }
  }
  return false
}

// noLossOfPrecision: `9007199254740993` — decimal numeric literal whose
// source text changes when parsed as a JavaScript Number. We read the source
// form instead of the parser's normalized .Text, which has already lost
// precision.
type noLossOfPrecision struct{}

func (noLossOfPrecision) Name() string           { return "no-loss-of-precision" }
func (noLossOfPrecision) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindNumericLiteral} }
func (noLossOfPrecision) Check(ctx *Context, node *shimast.Node) {
  source := strings.TrimSpace(nodeText(ctx.File, node))
  if source == "" {
    return
  }
  if numericLiteralLosesPrecision(source) {
    ctx.Report(node, "This number literal will lose precision at runtime.")
  }
}

// numericLiteralLosesPrecision reports whether the decimal integer literal text
// changes when parsed as a JavaScript Number. Non-decimal literals (hex, octal,
// binary) and literals with exponents or decimal points are exempt because
// their precision loss is caller-visible and intentional.
func numericLiteralLosesPrecision(text string) bool {
  // Strip underscore separators, exponents, decimal/hex/oct/binary
  // markers — for the simple-base-10 integer case the round-trip
  // parse → format check is sufficient.
  clean := strings.ReplaceAll(text, "_", "")
  if strings.ContainsAny(clean, "eE.xXoObB") {
    return false
  }
  if len(clean) < 16 {
    return false
  }
  // Trim leading zeros for comparison.
  trimmed := strings.TrimLeft(clean, "0")
  if trimmed == "" {
    return false
  }
  // 2^53 is unsafe for arithmetic comparisons but still exactly representable.
  // 2^53+1 is the first plain decimal integer that changes when parsed.
  const firstPossibleLoss = "9007199254740993"
  if len(trimmed) < len(firstPossibleLoss) {
    return false
  }
  if len(trimmed) == len(firstPossibleLoss) && trimmed < firstPossibleLoss {
    return false
  }
  // Number.MAX_VALUE is around 1.79e308, so any integer with more than 309
  // decimal digits cannot round-trip through a finite JavaScript Number.
  const maxFiniteDecimalDigits = 309
  if len(trimmed) > maxFiniteDecimalDigits {
    return true
  }
  parsed, err := strconv.ParseFloat(trimmed, 64)
  if err != nil && parsed == 0 {
    return false
  }
  return strconv.FormatFloat(parsed, 'f', 0, 64) != trimmed
}

// noClassAssign: assigning to a class declaration's name.
type noClassAssign struct{}

func (noClassAssign) Name() string           { return "no-class-assign" }
func (noClassAssign) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }
func (noClassAssign) Check(ctx *Context, node *shimast.Node) {
  reportAssignmentsToDeclarations(ctx, node, shimast.KindClassDeclaration, "is a class.")
}

// noFuncAssign: same idea, but for function declarations.
type noFuncAssign struct{}

func (noFuncAssign) Name() string           { return "no-func-assign" }
func (noFuncAssign) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }
func (noFuncAssign) Check(ctx *Context, node *shimast.Node) {
  reportAssignmentsToDeclarations(ctx, node, shimast.KindFunctionDeclaration, "is a function.")
}

// reportAssignmentsToDeclarations flags every `<name> = …` assignment whose
// target identifier names a `declKind` declaration found anywhere in the
// file. It walks the file exactly once — gathering declared names and
// assignment targets in the same pass — so the cost is linear in file size.
//
// The earlier shape registered for `declKind` directly and, on every
// declaration, re-scanned the whole file for assignments: O(declarations ×
// file size), which blows up quadratically on a file with many top-level
// functions. Visiting `KindSourceFile` once and cross-referencing afterward
// keeps the same findings without the repeated scans.
func reportAssignmentsToDeclarations(
  ctx *Context,
  file *shimast.Node,
  declKind shimast.Kind,
  noun string,
) {
  if ctx == nil || file == nil {
    return
  }
  declared := map[string]struct{}{}
  var targets []*shimast.Node
  walkDescendants(file, func(n *shimast.Node) {
    switch n.Kind {
    case declKind:
      if name := declarationName(n); name != "" {
        declared[name] = struct{}{}
      }
    case shimast.KindBinaryExpression:
      if expr := n.AsBinaryExpression(); expr != nil &&
        expr.OperatorToken != nil && isAssignmentOperator(expr.OperatorToken.Kind) &&
        expr.Left != nil && expr.Left.Kind == shimast.KindIdentifier {
        targets = append(targets, expr.Left)
      }
    }
  })
  if len(declared) == 0 || len(targets) == 0 {
    return
  }
  for _, target := range targets {
    name := identifierText(target)
    if _, ok := declared[name]; ok {
      ctx.Report(target, "'"+name+"' "+noun)
    }
  }
}

// declarationName returns the bound name of a class or function declaration
// node, or "" when the node is neither (or is anonymous).
func declarationName(n *shimast.Node) string {
  switch n.Kind {
  case shimast.KindFunctionDeclaration:
    if d := n.AsFunctionDeclaration(); d != nil {
      return identifierText(d.Name())
    }
  case shimast.KindClassDeclaration:
    if d := n.AsClassDeclaration(); d != nil {
      return identifierText(d.Name())
    }
  }
  return ""
}

// noPrototypeBuiltins: `obj.hasOwnProperty(x)` — should be
// `Object.prototype.hasOwnProperty.call(obj, x)` or `Object.hasOwn`.
type noPrototypeBuiltins struct{}

func (noPrototypeBuiltins) Name() string           { return "no-prototype-builtins" }
func (noPrototypeBuiltins) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindCallExpression} }
func (noPrototypeBuiltins) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || call.Expression == nil {
    return
  }
  if call.Expression.Kind != shimast.KindPropertyAccessExpression {
    return
  }
  access := call.Expression.AsPropertyAccessExpression()
  if access == nil {
    return
  }
  method := identifierText(access.Name())
  switch method {
  case "hasOwnProperty", "isPrototypeOf", "propertyIsEnumerable":
    ctx.Report(node, "Do not access Object.prototype method '"+method+"' from target object.")
  }
}

// noAsyncPromiseExecutor: `new Promise(async (resolve) => {...})`.
type noAsyncPromiseExecutor struct{}

func (noAsyncPromiseExecutor) Name() string { return "no-async-promise-executor" }
func (noAsyncPromiseExecutor) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindNewExpression}
}
func (noAsyncPromiseExecutor) Check(ctx *Context, node *shimast.Node) {
  ne := node.AsNewExpression()
  if ne == nil || identifierText(ne.Expression) != "Promise" {
    return
  }
  if ne.Arguments == nil || len(ne.Arguments.Nodes) == 0 {
    return
  }
  executor := ne.Arguments.Nodes[0]
  if executor == nil {
    return
  }
  if !isFunctionLikeKind(executor) {
    return
  }
  if hasAsyncModifier(executor) {
    ctx.Report(executor, "Promise executor functions should not be async.")
  }
}

// noPromiseExecutorReturn: `new Promise(() => 1)` — the value is
// thrown away.
type noPromiseExecutorReturn struct{}

func (noPromiseExecutorReturn) Name() string { return "no-promise-executor-return" }
func (noPromiseExecutorReturn) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindNewExpression}
}
func (noPromiseExecutorReturn) Check(ctx *Context, node *shimast.Node) {
  ne := node.AsNewExpression()
  if ne == nil || identifierText(ne.Expression) != "Promise" {
    return
  }
  if ne.Arguments == nil || len(ne.Arguments.Nodes) == 0 {
    return
  }
  executor := ne.Arguments.Nodes[0]
  if executor == nil || executor.Kind != shimast.KindArrowFunction {
    return
  }
  arrow := executor.AsArrowFunction()
  if arrow == nil || arrow.Body == nil {
    return
  }
  // Concise arrow body returns the value implicitly.
  if arrow.Body.Kind != shimast.KindBlock {
    ctx.Report(arrow.Body, "Return values from promise executor functions cannot be read.")
  }
}

// noControlRegex: `/\x00/` — control characters in regex are usually
// the result of accidentally typing the escape rather than the printable
// counterpart.
type noControlRegex struct{}

func (noControlRegex) Name() string { return "no-control-regex" }
func (noControlRegex) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindRegularExpressionLiteral}
}
func (noControlRegex) Check(ctx *Context, node *shimast.Node) {
  src := nodeText(ctx.File, node)
  if regexContainsControl(src) {
    ctx.Report(node, "Unexpected control character(s) in regular expression.")
  }
}

// regexContainsControl reports whether the regex source text src contains a
// literal control character (U+0000–U+001F, excluding \t, \n, \r) or a
// \xNN / \uNNNN escape that resolves to a control character.
func regexContainsControl(src string) bool {
  for i := 0; i < len(src); i++ {
    c := src[i]
    if c == '\\' && i+1 < len(src) {
      next := src[i+1]
      if next == 'x' && i+3 < len(src) {
        value := hexDigit(src[i+2])*16 + hexDigit(src[i+3])
        if value >= 0 && value < 0x20 {
          return true
        }
        i += 3
        continue
      }
      if next == 'u' && i+5 < len(src) {
        value := hexDigit(src[i+2])*4096 + hexDigit(src[i+3])*256 + hexDigit(src[i+4])*16 + hexDigit(src[i+5])
        if value >= 0 && value < 0x20 {
          return true
        }
        i += 5
        continue
      }
      i++
      continue
    }
    if c < 0x20 && c != '\t' && c != '\n' && c != '\r' {
      return true
    }
  }
  return false
}

// hexDigit converts an ASCII hex byte ('0'-'9', 'a'-'f', 'A'-'F') to its
// integer value. Returns -1 for non-hex bytes.
func hexDigit(b byte) int {
  switch {
  case b >= '0' && b <= '9':
    return int(b - '0')
  case b >= 'a' && b <= 'f':
    return int(b-'a') + 10
  case b >= 'A' && b <= 'F':
    return int(b-'A') + 10
  }
  return -1
}

// noIrregularWhitespace: zero-width spaces, NBSP, etc. The TS parser
// accepts them but copy-paste into source is almost always a mistake.
type noIrregularWhitespace struct{}

func (noIrregularWhitespace) Name() string           { return "no-irregular-whitespace" }
func (noIrregularWhitespace) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }
func (noIrregularWhitespace) Check(ctx *Context, node *shimast.Node) {
  if ctx.File == nil {
    return
  }
  text := ctx.File.Text()
  for i, r := range text {
    if isIrregularWhitespace(r) {
      ctx.ReportRange(i, i+len(string(r)), "Irregular whitespace not allowed.")
    }
  }
}

// isIrregularWhitespace reports whether rune r is a non-standard whitespace
// character that the TypeScript parser accepts but is almost certainly a
// copy-paste artifact: vertical tab, form feed, non-breaking space, and the
// various Unicode space and line separator code points.
func isIrregularWhitespace(r rune) bool {
  switch r {
  case '\v', '\f',
    0x00A0, 0x1680,
    0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005,
    0x2006, 0x2007, 0x2008, 0x2009, 0x200A,
    0x200B, 0x202F, 0x205F,
    0x3000,
    0x2028, 0x2029,
    0xFEFF:
    return true
  }
  return false
}

// noFallthrough: `switch` cases that fall through to the next label
// without an explicit `break` / `return` / `throw` / `continue`.
type noFallthrough struct{}

func (noFallthrough) Name() string           { return "no-fallthrough" }
func (noFallthrough) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSwitchStatement} }
func (noFallthrough) Check(ctx *Context, node *shimast.Node) {
  sw := node.AsSwitchStatement()
  if sw == nil || sw.CaseBlock == nil {
    return
  }
  block := sw.CaseBlock.AsCaseBlock()
  if block == nil || block.Clauses == nil {
    return
  }
  clauses := block.Clauses.Nodes
  for i := 0; i+1 < len(clauses); i++ {
    clause := clauses[i].AsCaseOrDefaultClause()
    if clause == nil || clause.Statements == nil {
      continue
    }
    stmts := clause.Statements.Nodes
    if len(stmts) == 0 {
      continue // empty case is intentional, never a fallthrough.
    }
    if !isTerminating(stmts[len(stmts)-1]) {
      ctx.Report(clauses[i+1], "Expected a 'break' statement before this case.")
    }
  }
}

// isTerminating reports whether stmt is a statement that unconditionally
// transfers control out of the current block: break, continue, return,
// throw, or a block whose last statement is terminating.
func isTerminating(stmt *shimast.Node) bool {
  if stmt == nil {
    return false
  }
  switch stmt.Kind {
  case shimast.KindBreakStatement,
    shimast.KindContinueStatement,
    shimast.KindReturnStatement,
    shimast.KindThrowStatement:
    return true
  case shimast.KindBlock:
    block := stmt.AsBlock()
    if block == nil || block.Statements == nil {
      return false
    }
    nodes := block.Statements.Nodes
    if len(nodes) == 0 {
      return false
    }
    return isTerminating(nodes[len(nodes)-1])
  }
  return false
}

// noInnerDeclarations: `function foo() { if (x) { function bar() {} } }`
// — inner function declarations are hoisted differently in strict mode
// vs sloppy and are confusing.
type noInnerDeclarations struct{}

func (noInnerDeclarations) Name() string { return "no-inner-declarations" }
func (noInnerDeclarations) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindFunctionDeclaration, shimast.KindVariableStatement}
}
func (noInnerDeclarations) Check(ctx *Context, node *shimast.Node) {
  if node.Kind == shimast.KindVariableStatement {
    stmt := node.AsVariableStatement()
    if stmt == nil || stmt.DeclarationList == nil {
      return
    }
    // Only `var` is hoisted oddly.
    if !shimast.IsVar(stmt.DeclarationList) {
      return
    }
  }
  parent := node.Parent
  if parent == nil {
    return
  }
  switch parent.Kind {
  case shimast.KindSourceFile, shimast.KindModuleBlock:
    return
  case shimast.KindBlock:
    grand := parent.Parent
    if grand == nil {
      return
    }
    if isFunctionLikeKind(grand) {
      return
    }
  }
  what := "function"
  if node.Kind == shimast.KindVariableStatement {
    what = "variable"
  }
  ctx.Report(node, "Move "+what+" declaration to the function scope.")
}

// noObjCalls: `Math()`, `JSON()` — these globals are objects, not
// callables. ESLint catches a small list.
type noObjCalls struct{}

func (noObjCalls) Name() string { return "no-obj-calls" }
func (noObjCalls) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression, shimast.KindNewExpression}
}
func (noObjCalls) Check(ctx *Context, node *shimast.Node) {
  var callee *shimast.Node
  if node.Kind == shimast.KindCallExpression {
    callee = node.AsCallExpression().Expression
  } else {
    callee = node.AsNewExpression().Expression
  }
  switch identifierText(callee) {
  case "Math", "JSON", "Reflect", "Atomics", "Intl":
    ctx.Report(node, "'"+identifierText(callee)+"' is not a function.")
  }
}

// hasAsyncModifier returns whether a function-like node carries the
// `async` keyword. Used by no-async-promise-executor.
func hasAsyncModifier(node *shimast.Node) bool {
  return hasModifier(node, shimast.KindAsyncKeyword)
}

// hasModifier returns whether a node's modifier list contains a token of
// the given kind. Generic over modifier kinds (async, static, abstract,
// override, public/private/protected, readonly) so individual rules don't
// have to re-implement the loop.
func hasModifier(node *shimast.Node, kind shimast.Kind) bool {
  if node == nil {
    return false
  }
  mods := node.Modifiers()
  if mods == nil {
    return false
  }
  for _, m := range mods.Nodes {
    if m != nil && m.Kind == kind {
      return true
    }
  }
  return false
}

func init() {
  Register(noDupeElseIf{})
  Register(noExAssign{})
  Register(noEmptyCharacterClass{})
  Register(noMisleadingCharacterClass{})
  Register(noLossOfPrecision{})
  Register(noClassAssign{})
  Register(noFuncAssign{})
  Register(noPrototypeBuiltins{})
  Register(noAsyncPromiseExecutor{})
  Register(noPromiseExecutorReturn{})
  Register(noControlRegex{})
  Register(noIrregularWhitespace{})
  Register(noFallthrough{})
  Register(noInnerDeclarations{})
  Register(noObjCalls{})
}
