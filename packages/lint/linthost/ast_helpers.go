package linthost

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

// tokenRange returns the half-open byte range [pos, end) of `node` with
// leading trivia stripped, mirroring what ReportFix would anchor to.
// Returns (-1, -1) when either argument is nil or the computed range is
// out of bounds.
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

// hasCommentBetween reports whether a comment begins anywhere in the source
// range [from, to). Fixers whose TextEdit keeps only part of the replaced
// span use it on the discarded sub-ranges: a comment there would be silently
// deleted by the edit, so the fix must be declined.
//
// The scan alternates SkipTriviaEx (whitespace, with StopAtComments so a
// comment opener is not consumed) with a two-byte opener check that
// distinguishes `//` and `/*` from a bare slash token. Non-trivia token
// bytes are stepped over one at a time, so an opener lookalike inside a
// string literal within the range would over-detect; callers only ever
// decline an autofix on a hit, which is the safe direction.
func hasCommentBetween(src string, from, to int) bool {
  if from < 0 {
    return false
  }
  if to > len(src) {
    to = len(src)
  }
  for pos := from; pos < to; {
    next := shimscanner.SkipTriviaEx(src, pos, &shimscanner.SkipTriviaOptions{StopAtComments: true})
    if next < pos || next >= to {
      return false
    }
    if src[next] == '/' && next+1 < len(src) && (src[next+1] == '/' || src[next+1] == '*') {
      return true
    }
    pos = next + 1
  }
  return false
}

// isIdentifierPart reports whether `ch` can appear inside a JavaScript
// identifier — used as a word-boundary guard by keyword search helpers.
// Handles only ASCII; multibyte Unicode identifier parts are treated as
// non-identifier (conservative; callers only need ASCII keyword tokens).
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

// sameReferenceExpression reports whether two expressions denote the same
// repeatable runtime reference. Parentheses and TypeScript's type-only
// expression wrappers are transparent; identifiers, primitive literals,
// `this` / `super`, and property or element-access chains are compared
// recursively. Calls and other effectful expressions are deliberately rejected
// even when their source text is identical because evaluating them twice need
// not produce the same value.
//
// Static member keys are normalized to their runtime property key, so `x.y`
// and `x["y"]` compare equal. Optional and non-optional member accesses remain
// distinct because optional chaining changes evaluation semantics.
func sameReferenceExpression(left, right *shimast.Node) bool {
  left = unwrapReferenceExpression(left)
  right = unwrapReferenceExpression(right)
  if left == nil || right == nil {
    return false
  }

  switch left.Kind {
  case shimast.KindIdentifier, shimast.KindPrivateIdentifier:
    return left.Kind == right.Kind && shimast.NodeText(left) == shimast.NodeText(right)
  case shimast.KindThisKeyword, shimast.KindSuperKeyword:
    return left.Kind == right.Kind
  case shimast.KindPropertyAccessExpression, shimast.KindElementAccessExpression:
    leftMember, ok := referenceMemberParts(left)
    if !ok {
      return false
    }
    rightMember, ok := referenceMemberParts(right)
    if !ok || leftMember.optional != rightMember.optional ||
      !sameReferenceExpression(leftMember.object, rightMember.object) {
      return false
    }
    if leftMember.staticKey != nil || rightMember.staticKey != nil {
      return leftMember.staticKey != nil && rightMember.staticKey != nil &&
        *leftMember.staticKey == *rightMember.staticKey &&
        leftMember.private == rightMember.private
    }
    return sameReferenceExpression(leftMember.dynamicKey, rightMember.dynamicKey)
  default:
    leftValue, leftKind, leftOK := referencePrimitiveValue(left)
    rightValue, rightKind, rightOK := referencePrimitiveValue(right)
    return leftOK && rightOK && leftKind == rightKind && leftValue == rightValue
  }
}

// unwrapReferenceExpression removes syntax that has no runtime evaluation of
// its own. Keep this list explicit: optional chains, calls, and instantiation
// expressions are not harmless wrappers and must remain visible to callers.
func unwrapReferenceExpression(node *shimast.Node) *shimast.Node {
  for node != nil {
    switch node.Kind {
    case shimast.KindParenthesizedExpression,
      shimast.KindAsExpression,
      shimast.KindSatisfiesExpression,
      shimast.KindNonNullExpression,
      shimast.KindTypeAssertionExpression:
      next := node.Expression()
      if next == nil {
        return node
      }
      node = next
    default:
      return node
    }
  }
  return nil
}

type referenceMember struct {
  object     *shimast.Node
  staticKey  *string
  dynamicKey *shimast.Node
  optional   bool
  private    bool
}

func referenceMemberParts(node *shimast.Node) (referenceMember, bool) {
  switch node.Kind {
  case shimast.KindPropertyAccessExpression:
    access := node.AsPropertyAccessExpression()
    if access == nil || access.Expression == nil || access.Name() == nil {
      return referenceMember{}, false
    }
    name := access.Name()
    if name.Kind != shimast.KindIdentifier && name.Kind != shimast.KindPrivateIdentifier {
      return referenceMember{}, false
    }
    key := shimast.NodeText(name)
    return referenceMember{
      object:    access.Expression,
      staticKey: &key,
      optional:  access.QuestionDotToken != nil,
      private:   name.Kind == shimast.KindPrivateIdentifier,
    }, true
  case shimast.KindElementAccessExpression:
    access := node.AsElementAccessExpression()
    if access == nil || access.Expression == nil || access.ArgumentExpression == nil {
      return referenceMember{}, false
    }
    member := referenceMember{
      object:     access.Expression,
      dynamicKey: access.ArgumentExpression,
      optional:   access.QuestionDotToken != nil,
    }
    if key, ok := referenceStaticPropertyKey(access.ArgumentExpression); ok {
      member.staticKey = &key
      member.dynamicKey = nil
    }
    return member, true
  default:
    return referenceMember{}, false
  }
}

func referenceStaticPropertyKey(node *shimast.Node) (string, bool) {
  node = unwrapReferenceExpression(node)
  if node == nil {
    return "", false
  }
  value, kind, ok := referencePrimitiveValue(node)
  if ok {
    if kind == "bigint" {
      value = strings.TrimSuffix(value, "n")
    }
    return value, true
  }
  if node.Kind != shimast.KindPrefixUnaryExpression {
    return "", false
  }
  prefix := node.AsPrefixUnaryExpression()
  if prefix == nil || prefix.Operand == nil {
    return "", false
  }
  value, kind, ok = referencePrimitiveValue(prefix.Operand)
  if !ok || (kind != "number" && kind != "bigint") {
    return "", false
  }
  value = strings.TrimSuffix(value, "n")
  switch prefix.Operator {
  case shimast.KindPlusToken:
    return value, kind == "number"
  case shimast.KindMinusToken:
    if strings.Trim(value, "0.") == "" {
      return "0", true
    }
    return "-" + value, true
  default:
    return "", false
  }
}

// referencePrimitiveValue returns a normalized value plus a runtime-kind tag.
// The tag keeps numerically similar values such as `1` and `1n` distinct when
// they are receivers; referenceStaticPropertyKey intentionally collapses them
// later because JavaScript converts both to the same string property key.
func referencePrimitiveValue(node *shimast.Node) (value, kind string, ok bool) {
  if node == nil {
    return "", "", false
  }
  switch node.Kind {
  case shimast.KindStringLiteral, shimast.KindNoSubstitutionTemplateLiteral:
    return stringLiteralText(node), "string", true
  case shimast.KindNumericLiteral:
    return numericLiteralText(node), "number", true
  case shimast.KindBigIntLiteral:
    return numericLiteralText(node), "bigint", true
  case shimast.KindTrueKeyword:
    return "true", "boolean", true
  case shimast.KindFalseKeyword:
    return "false", "boolean", true
  case shimast.KindNullKeyword:
    return "null", "null", true
  default:
    return "", "", false
  }
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
//
// The naive recursive shape `node.ForEachChild(func(child) bool {
// walkDescendants(child, visit); return false })` allocates one
// closure per recursive call (the inner func captures `visit` and
// the outer function reference), so a subtree of N nodes costs N
// closure allocations. The struct walker below caches the
// `ForEachChild` callback as a method value bound once to the
// walker, dropping that cost to one allocation per `walkDescendants`
// call regardless of subtree size.
func walkDescendants(node *shimast.Node, visit func(*shimast.Node)) {
  if node == nil {
    return
  }
  w := &descendantsWalker{visit: visit}
  w.childCB = w.visitChild
  w.walk(node)
}

type descendantsWalker struct {
  visit   func(*shimast.Node)
  childCB func(*shimast.Node) bool
}

func (w *descendantsWalker) walk(node *shimast.Node) {
  if node == nil {
    return
  }
  w.visit(node)
  node.ForEachChild(w.childCB)
}

func (w *descendantsWalker) visitChild(child *shimast.Node) bool {
  w.walk(child)
  return false
}

// assignmentTargetIdentifiers collects the Identifier nodes written by an
// assignment's left-hand side. A bare Identifier yields one node. A
// destructuring-assignment target — parsed as an ArrayLiteralExpression
// (`[a, b] = …`) or ObjectLiteralExpression (`({a} = …)`) rather than a
// binding pattern — is walked so every nested write position is counted:
// array elements, object property values, shorthand properties, defaults
// (`[a = 1]`, `{a = 1}`), nested patterns, and rest elements.
//
// TypeScript assertion wrappers are transparent in reference position, so
// `as`, angle-bracket assertions, `satisfies`, non-null assertions, and
// parentheses are unwrapped recursively wherever they appear in a target.
// Property names in `{key: target}` are read positions, not writes, so only
// the property value contributes; member-access targets (`obj.x`) declare no
// local binding and are skipped. Returns nil for other shapes.
func assignmentTargetIdentifiers(node *shimast.Node) []*shimast.Node {
  if node == nil {
    return nil
  }
  if node.Kind == shimast.KindIdentifier {
    return []*shimast.Node{node}
  }
  var identifiers []*shimast.Node
  collectAssignmentTargetIdentifiers(node, &identifiers)
  return identifiers
}

// assignmentTargetNames is the text-only projection used by rules that do not
// need binding identity.
func assignmentTargetNames(node *shimast.Node) []string {
  identifiers := assignmentTargetIdentifiers(node)
  if len(identifiers) == 0 {
    return nil
  }
  names := make([]string, 0, len(identifiers))
  for _, identifier := range identifiers {
    if name := identifierText(identifier); name != "" {
      names = append(names, name)
    }
  }
  return names
}

// isDestructuringAssignmentTarget reports whether node belongs to the left
// side of a destructuring assignment. TypeScript-Go represents those targets
// as array/object literal expressions rather than binding-pattern nodes.
// Property keys, computed names, and default-value expressions are reads and
// therefore stop the target walk.
func isDestructuringAssignmentTarget(node *shimast.Node) bool {
  child := node
  for child != nil && child.Parent != nil {
    parent := child.Parent
    switch parent.Kind {
    case shimast.KindBindingElement:
      binding := parent.AsBindingElement()
      if binding != nil &&
        (binding.PropertyName == child || binding.Initializer == child) {
        return false
      }
    case shimast.KindPropertyAssignment:
      property := parent.AsPropertyAssignment()
      if property != nil && property.Name() == child {
        return false
      }
    case shimast.KindShorthandPropertyAssignment:
      property := parent.AsShorthandPropertyAssignment()
      if property != nil && property.ObjectAssignmentInitializer == child {
        return false
      }
    case shimast.KindComputedPropertyName:
      return false
    case shimast.KindForInStatement, shimast.KindForOfStatement:
      statement := parent.AsForInOrOfStatement()
      return statement != nil && statement.Initializer == child
    }
    if parent.Kind == shimast.KindBinaryExpression {
      expression := parent.AsBinaryExpression()
      if expression != nil && expression.OperatorToken != nil &&
        expression.OperatorToken.Kind == shimast.KindEqualsToken {
        if expression.Left == child {
          return true
        }
        if expression.Right == child {
          return false
        }
      }
    }
    child = parent
  }
  return false
}

// collectAssignmentTargetIdentifiers appends to `identifiers` every identifier in a
// destructuring-assignment target. It descends only through write-target
// positions so reads (object property keys, computed-member expressions)
// never count as reassignments.
func collectAssignmentTargetIdentifiers(node *shimast.Node, identifiers *[]*shimast.Node) {
  if node == nil {
    return
  }
  switch node.Kind {
  case shimast.KindIdentifier:
    *identifiers = append(*identifiers, node)
  case shimast.KindParenthesizedExpression:
    collectAssignmentTargetIdentifiers(stripParens(node), identifiers)
  case shimast.KindNonNullExpression:
    if expression := node.AsNonNullExpression(); expression != nil {
      collectAssignmentTargetIdentifiers(expression.Expression, identifiers)
    }
  case shimast.KindAsExpression:
    if expression := node.AsAsExpression(); expression != nil {
      collectAssignmentTargetIdentifiers(expression.Expression, identifiers)
    }
  case shimast.KindTypeAssertionExpression:
    if expression := node.AsTypeAssertion(); expression != nil {
      collectAssignmentTargetIdentifiers(expression.Expression, identifiers)
    }
  case shimast.KindSatisfiesExpression:
    if expression := node.AsSatisfiesExpression(); expression != nil {
      collectAssignmentTargetIdentifiers(expression.Expression, identifiers)
    }
  case shimast.KindArrayLiteralExpression:
    if arr := node.AsArrayLiteralExpression(); arr != nil && arr.Elements != nil {
      for _, el := range arr.Elements.Nodes {
        collectAssignmentTargetIdentifiers(el, identifiers)
      }
    }
  case shimast.KindObjectLiteralExpression:
    if obj := node.AsObjectLiteralExpression(); obj != nil && obj.Properties != nil {
      for _, prop := range obj.Properties.Nodes {
        collectAssignmentTargetIdentifiers(prop, identifiers)
      }
    }
  case shimast.KindSpreadElement:
    if spread := node.AsSpreadElement(); spread != nil {
      collectAssignmentTargetIdentifiers(spread.Expression, identifiers)
    }
  case shimast.KindSpreadAssignment:
    if spread := node.AsSpreadAssignment(); spread != nil {
      collectAssignmentTargetIdentifiers(spread.Expression, identifiers)
    }
  case shimast.KindShorthandPropertyAssignment:
    // `{a}` and `{a = 1}` — the property name is the write target; any
    // ObjectAssignmentInitializer is a default value, not a target.
    if short := node.AsShorthandPropertyAssignment(); short != nil {
      collectAssignmentTargetIdentifiers(short.Name(), identifiers)
    }
  case shimast.KindPropertyAssignment:
    // `{key: target}` — only the value (initializer) is written to.
    if assignment := node.AsPropertyAssignment(); assignment != nil {
      collectAssignmentTargetIdentifiers(assignment.Initializer, identifiers)
    }
  case shimast.KindBinaryExpression:
    // A default inside a pattern (`[a = 1]`, `{key: a = 1}`) parses as an
    // `=` BinaryExpression; only its left side is the write target.
    if expr := node.AsBinaryExpression(); expr != nil &&
      expr.OperatorToken != nil && expr.OperatorToken.Kind == shimast.KindEqualsToken {
      collectAssignmentTargetIdentifiers(expr.Left, identifiers)
    }
  }
}

// isLiteralLike reports whether `node` (after stripping parentheses) is a
// compile-time constant expression: a bare literal or a unary `+`/`-`
// applied to a numeric or bigint literal. Used by rules that flag
// constant-valued operands (e.g. `no-constant-condition`).
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
