package main

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// nodeText returns the source text under a node with all leading
// trivia stripped — both whitespace AND comments. Used by rules that
// compare textual identity (e.g. `no-self-assign`, `no-self-compare`,
// `operator-assignment`); naively reading `src[node.Pos():node.End()]`
// would include any preceding comment because tsgo's Pos points at
// the start of leading trivia, not the actual token.
func nodeText(file *shimast.SourceFile, node *shimast.Node) string {
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

// keywordStart returns the source offset of a declaration keyword such as
// `var` or `let` at the start of a node after leading trivia.
func keywordStart(file *shimast.SourceFile, node *shimast.Node, keyword string) int {
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

// findKeyword scans [pos, end) for a keyword token whose lexeme is
// `keyword`. Returns the byte offset of the keyword's first character,
// or -1 if not found. Unlike keywordStart this is unbounded by a node's
// leading-trivia start, so it can locate `module` inside a
// ModuleDeclaration or insert points like the end of `import`.
//
// The match is identifier-aware: a hit must be preceded and followed by
// a non-identifier byte so that e.g. searching for `import` does not
// match the `import` prefix of `importStr`.
func findKeyword(file *shimast.SourceFile, pos, end int, keyword string) int {
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

func tokenRange(file *shimast.SourceFile, node *shimast.Node) (int, int) {
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

// identifierText returns the lexical name of an Identifier node, or "" if
// the node isn't an Identifier.
func identifierText(node *shimast.Node) string {
  if node == nil || node.Kind != shimast.KindIdentifier {
    return ""
  }
  id := node.AsIdentifier()
  if id == nil {
    return ""
  }
  return id.Text
}

// stripParens descends through ParenthesizedExpression nodes and returns
// the first non-parenthesized child. ESLint rules typically operate on
// the canonical form.
func stripParens(node *shimast.Node) *shimast.Node {
  for node != nil && node.Kind == shimast.KindParenthesizedExpression {
    next := node.AsParenthesizedExpression()
    if next == nil || next.Expression == nil {
      return node
    }
    node = next.Expression
  }
  return node
}

// isMatchingPropertyAccess reports whether `node` reads the chain
// `head.tail[0].tail[1]…`. Useful for detecting `obj.__proto__` or
// `console.log` shapes regardless of nesting.
func isMatchingPropertyAccess(node *shimast.Node, head string, tail ...string) bool {
  if node == nil || node.Kind != shimast.KindPropertyAccessExpression {
    return false
  }
  chain := []*shimast.Node{}
  cur := node
  for cur != nil && cur.Kind == shimast.KindPropertyAccessExpression {
    access := cur.AsPropertyAccessExpression()
    if access == nil {
      return false
    }
    chain = append([]*shimast.Node{access.Name()}, chain...)
    cur = access.Expression
  }
  if cur == nil || identifierText(cur) != head {
    return false
  }
  if len(chain) != len(tail) {
    return false
  }
  for i, want := range tail {
    if identifierText(chain[i]) != want {
      return false
    }
  }
  return true
}

// isLiteralBoolean returns the boolean value (and ok=true) for a
// `KindTrueKeyword` / `KindFalseKeyword` literal. Other nodes return
// (false, false).
func isLiteralBoolean(node *shimast.Node) (bool, bool) {
  if node == nil {
    return false, false
  }
  switch node.Kind {
  case shimast.KindTrueKeyword:
    return true, true
  case shimast.KindFalseKeyword:
    return false, true
  }
  return false, false
}

// isLiteralExpression returns true for nodes whose value is intrinsically
// truthy / falsy at parse time — these flag `no-constant-condition` etc.
func isLiteralExpression(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  switch node.Kind {
  case
    shimast.KindStringLiteral,
    shimast.KindNumericLiteral,
    shimast.KindBigIntLiteral,
    shimast.KindNoSubstitutionTemplateLiteral,
    shimast.KindRegularExpressionLiteral,
    shimast.KindTrueKeyword,
    shimast.KindFalseKeyword,
    shimast.KindNullKeyword:
    return true
  }
  return false
}

// callCalleeName returns the simple-identifier callee of a CallExpression
// (e.g. `eval` from `eval("...")`). Returns "" when the callee is more
// complex than a bare identifier.
func callCalleeName(call *shimast.CallExpression) string {
  if call == nil || call.Expression == nil {
    return ""
  }
  return identifierText(call.Expression)
}

// numericLiteralText returns the literal text of a numeric / bigint
// literal, normalized for the comparisons rules need (`-0`, `0xFF`).
func numericLiteralText(node *shimast.Node) string {
  if node == nil {
    return ""
  }
  switch node.Kind {
  case shimast.KindNumericLiteral:
    if lit := node.AsNumericLiteral(); lit != nil {
      return lit.Text
    }
  case shimast.KindBigIntLiteral:
    if lit := node.AsBigIntLiteral(); lit != nil {
      return lit.Text
    }
  }
  return ""
}

// stringLiteralText returns the value of a string-shaped literal:
// StringLiteral or NoSubstitutionTemplateLiteral.
func stringLiteralText(node *shimast.Node) string {
  if node == nil {
    return ""
  }
  switch node.Kind {
  case shimast.KindStringLiteral:
    if lit := node.AsStringLiteral(); lit != nil {
      return lit.Text
    }
  case shimast.KindNoSubstitutionTemplateLiteral:
    if lit := node.AsNoSubstitutionTemplateLiteral(); lit != nil {
      return lit.Text
    }
  }
  return ""
}

// walkDescendants visits node and every child below it, depth-first.
func walkDescendants(node *shimast.Node, visit func(*shimast.Node)) {
  if node == nil {
    return
  }
  visit(node)
  node.ForEachChild(func(child *shimast.Node) bool {
    walkDescendants(child, visit)
    return false
  })
}

func bindingIdentifierNames(node *shimast.Node) []string {
  if node == nil {
    return nil
  }
  if name := identifierText(node); name != "" {
    return []string{name}
  }
  if node.Kind != shimast.KindObjectBindingPattern && node.Kind != shimast.KindArrayBindingPattern {
    return nil
  }
  var names []string
  walkDescendants(node, func(child *shimast.Node) {
    if child == node {
      return
    }
    if name := identifierText(child); name != "" {
      names = append(names, name)
    }
  })
  return names
}

func isLiteralLike(node *shimast.Node) bool {
  node = stripParens(node)
  if node == nil {
    return false
  }
  if isLiteralExpression(node) {
    return true
  }
  if node.Kind == shimast.KindPrefixUnaryExpression {
    prefix := node.AsPrefixUnaryExpression()
    if prefix == nil {
      return false
    }
    switch prefix.Operator {
    case shimast.KindPlusToken, shimast.KindMinusToken:
      return prefix.Operand != nil &&
        (prefix.Operand.Kind == shimast.KindNumericLiteral || prefix.Operand.Kind == shimast.KindBigIntLiteral)
    }
  }
  return false
}
