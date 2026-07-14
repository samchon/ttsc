// Bulk implementation of ESLint's "Possible Problems" category.
//
// Each rule keeps to pure-AST checks (no scope analysis, no checker
// queries beyond what's already in the rule's own walk) so they remain
// fast and predictable. Rules that require scope binding or
// flow-sensitive analysis are intentionally not implemented here —
// those are upstream's job.
package linthost

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// noDupeElseIf rejects an else-if branch when earlier conditions in the
// same chain already cover every path that can make its condition true.
type noDupeElseIf struct{}

func (noDupeElseIf) Name() string           { return "no-dupe-else-if" }
func (noDupeElseIf) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindIfStatement} }
func (noDupeElseIf) Check(ctx *Context, node *shimast.Node) {
  statement := node.AsIfStatement()
  if statement == nil || statement.Expression == nil {
    return
  }

  test := stripParens(statement.Expression)
  conditionsToCheck := []*shimast.Node{test}
  if noDupeElseIfLogicalOperator(test) == shimast.KindAmpersandAmpersandToken {
    conditionsToCheck = append(conditionsToCheck, noDupeElseIfSplit(test, shimast.KindAmpersandAmpersandToken)...)
  }

  candidates := make([][][]*shimast.Node, 0, len(conditionsToCheck))
  for _, condition := range conditionsToCheck {
    orOperands := noDupeElseIfSplit(condition, shimast.KindBarBarToken)
    conjunctions := make([][]*shimast.Node, 0, len(orOperands))
    for _, operand := range orOperands {
      conjunctions = append(conjunctions, noDupeElseIfSplit(operand, shimast.KindAmpersandAmpersandToken))
    }
    candidates = append(candidates, conjunctions)
  }

  current := node
  for current.Parent != nil && current.Parent.Kind == shimast.KindIfStatement {
    parent := current.Parent
    parentStatement := parent.AsIfStatement()
    if parentStatement == nil || parentStatement.ElseStatement != current || parentStatement.Expression == nil {
      break
    }

    earlierOrOperands := noDupeElseIfSplit(stripParens(parentStatement.Expression), shimast.KindBarBarToken)
    earlierConjunctions := make([][]*shimast.Node, 0, len(earlierOrOperands))
    for _, operand := range earlierOrOperands {
      earlierConjunctions = append(earlierConjunctions, noDupeElseIfSplit(operand, shimast.KindAmpersandAmpersandToken))
    }

    for i, disjunction := range candidates {
      remaining := disjunction[:0]
      for _, conjunction := range disjunction {
        covered := false
        for _, earlier := range earlierConjunctions {
          if noDupeElseIfSubset(ctx.File, earlier, conjunction) {
            covered = true
            break
          }
        }
        if !covered {
          remaining = append(remaining, conjunction)
        }
      }
      candidates[i] = remaining
      if len(remaining) == 0 {
        ctx.Report(statement.Expression, "This branch can never execute. Its condition is a duplicate or covered by previous conditions in the if-else-if chain.")
        return
      }
    }

    current = parent
  }
}

func noDupeElseIfLogicalOperator(node *shimast.Node) shimast.Kind {
  node = stripParens(node)
  if node == nil || node.Kind != shimast.KindBinaryExpression {
    return shimast.KindUnknown
  }
  expression := node.AsBinaryExpression()
  if expression == nil || expression.OperatorToken == nil {
    return shimast.KindUnknown
  }
  switch expression.OperatorToken.Kind {
  case shimast.KindAmpersandAmpersandToken, shimast.KindBarBarToken:
    return expression.OperatorToken.Kind
  default:
    return shimast.KindUnknown
  }
}

func noDupeElseIfSplit(node *shimast.Node, operator shimast.Kind) []*shimast.Node {
  node = stripParens(node)
  if noDupeElseIfLogicalOperator(node) != operator {
    return []*shimast.Node{node}
  }
  expression := node.AsBinaryExpression()
  operands := noDupeElseIfSplit(expression.Left, operator)
  return append(operands, noDupeElseIfSplit(expression.Right, operator)...)
}

func noDupeElseIfSubset(file *shimast.SourceFile, subset, set []*shimast.Node) bool {
  for _, candidate := range subset {
    matched := false
    for _, element := range set {
      if noDupeElseIfEqual(file, candidate, element) {
        matched = true
        break
      }
    }
    if !matched {
      return false
    }
  }
  return true
}

// noDupeElseIfEqual compares boolean expressions structurally. Logical AND
// and OR are commutative in a condition's truth table; every other expression
// must retain the same token kinds and values.
func noDupeElseIfEqual(file *shimast.SourceFile, left, right *shimast.Node) bool {
  left = stripParens(left)
  right = stripParens(right)
  if left == nil || right == nil || left.Kind != right.Kind {
    return false
  }

  operator := noDupeElseIfLogicalOperator(left)
  if operator != shimast.KindUnknown && operator == noDupeElseIfLogicalOperator(right) {
    leftExpression := left.AsBinaryExpression()
    rightExpression := right.AsBinaryExpression()
    return noDupeElseIfEqual(file, leftExpression.Left, rightExpression.Left) &&
      noDupeElseIfEqual(file, leftExpression.Right, rightExpression.Right) ||
      noDupeElseIfEqual(file, leftExpression.Left, rightExpression.Right) &&
        noDupeElseIfEqual(file, leftExpression.Right, rightExpression.Left)
  }

  return noDupeElseIfEqualTokens(file, left, right)
}

func noDupeElseIfEqualTokens(file *shimast.SourceFile, left, right *shimast.Node) bool {
  leftText := nodeText(file, left)
  rightText := nodeText(file, right)
  if leftText == "" || rightText == "" {
    return false
  }

  leftScanner := shimscanner.NewScanner()
  leftScanner.SetText(leftText)
  leftScanner.SetSkipTrivia(true)
  rightScanner := shimscanner.NewScanner()
  rightScanner.SetText(rightText)
  rightScanner.SetSkipTrivia(true)

  for {
    leftKind := leftScanner.Scan()
    rightKind := rightScanner.Scan()
    if leftKind != rightKind || leftScanner.TokenText() != rightScanner.TokenText() {
      return false
    }
    if leftKind == shimast.KindEndOfFile {
      return true
    }
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
// `root`. Used by noExAssign to scan a single catch block; the file-wide
// noClassAssign scan goes through
// reportAssignmentsToDeclarations instead. noFuncAssign requires checker
// binding identity and lives in rules_no_func_assign.go.
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
  parts, ok := parseRegexpLiteralParts(ctx, node)
  if ok && regexpHasEmptyCharacterClass(parts) {
    ctx.Report(node, "Empty class.")
  }
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

// noLossOfPrecision: a Number literal whose requested significant digits
// change during IEEE-754 conversion. We read the source form instead of the
// parser's normalized .Text, which has already lost spelling and precision.
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

// noClassAssign: assigning to a class declaration's name.
type noClassAssign struct{}

func (noClassAssign) Name() string           { return "no-class-assign" }
func (noClassAssign) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }
func (noClassAssign) Check(ctx *Context, node *shimast.Node) {
  reportAssignmentsToDeclarations(ctx, node, shimast.KindClassDeclaration, "is a class.")
}

// reportAssignmentsToDeclarations flags every `<name> = …` assignment whose
// target identifier names a `declKind` declaration found anywhere in the
// file. It walks the file exactly once — gathering declared names and
// assignment targets in the same pass — so the cost is linear in file size.
//
// The earlier shape registered for `declKind` directly and, on every
// declaration, re-scanned the whole file for assignments: O(declarations ×
// file size), which blows up quadratically on a file with many declarations.
// Visiting `KindSourceFile` once and cross-referencing afterward
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
  Register(noPrototypeBuiltins{})
  Register(noAsyncPromiseExecutor{})
  Register(noControlRegex{})
  Register(noIrregularWhitespace{})
  Register(noObjCalls{})
}
