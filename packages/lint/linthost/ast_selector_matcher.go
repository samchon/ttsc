package linthost

import (
  "errors"
  "math"
  "math/big"
  "strconv"
  "strings"
  "unicode/utf16"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// matchASTSelector returns every node selected below root. A configured
// selector reports each node once even when multiple alternatives or subject
// paths reach it.
func matchASTSelector(root *shimast.Node, selector *astSelector) []*shimast.Node {
  if root == nil || selector == nil {
    return nil
  }
  subjects := astSelectorSubjects(selector, selector)
  selected := make(map[*shimast.Node]struct{})
  ordered := make([]*shimast.Node, 0)
  walkDescendants(root, func(node *shimast.Node) {
    if !astSelectorMatchesNode(node, selector, nil) {
      return
    }
    if len(subjects) == 0 {
      if _, duplicate := selected[node]; !duplicate {
        selected[node] = struct{}{}
        ordered = append(ordered, node)
      }
      return
    }
    for candidate := node; candidate != nil; candidate = selectorParent(candidate) {
      for _, subject := range subjects {
        if !astSelectorMatchesNode(candidate, subject, nil) {
          continue
        }
        if _, duplicate := selected[candidate]; !duplicate {
          selected[candidate] = struct{}{}
          ordered = append(ordered, candidate)
        }
        break
      }
    }
  })
  return ordered
}

func astSelectorSubjects(selector, ancestor *astSelector) []*astSelector {
  if selector == nil {
    return nil
  }
  subjects := make([]*astSelector, 0)
  if selector.subject {
    subjects = append(subjects, ancestor)
  }
  if selector.left != nil {
    subjects = append(subjects, astSelectorSubjects(selector.left, selector.left)...)
  }
  if selector.right != nil {
    subjects = append(subjects, astSelectorSubjects(selector.right, ancestor)...)
  }
  for _, child := range selector.selectors {
    subjects = append(subjects, astSelectorSubjects(child, ancestor)...)
  }
  return subjects
}

func astSelectorMatchesNode(node *shimast.Node, selector *astSelector, scopeRoot *shimast.Node) bool {
  if node == nil || selector == nil {
    return false
  }
  switch selector.kind {
  case astSelectorWildcard:
    return true
  case astSelectorNodeType:
    return astSelectorMatchesNodeType(node, selector.name)
  case astSelectorExactNode:
    return scopeRoot != nil && node == scopeRoot
  case astSelectorAttribute:
    return astSelectorMatchesAttribute(node, selector)
  case astSelectorField:
    return astSelectorMatchesField(node, selector.name)
  case astSelectorMatches:
    for _, alternative := range selector.selectors {
      if astSelectorMatchesNode(node, alternative, scopeRoot) {
        return true
      }
    }
    return false
  case astSelectorCompound:
    for _, part := range selector.selectors {
      if !astSelectorMatchesNode(node, part, scopeRoot) {
        return false
      }
    }
    return true
  case astSelectorNot:
    for _, excluded := range selector.selectors {
      if astSelectorMatchesNode(node, excluded, scopeRoot) {
        return false
      }
    }
    return true
  case astSelectorHas:
    found := false
    walkDescendants(node, func(candidate *shimast.Node) {
      if found {
        return
      }
      for _, nested := range selector.selectors {
        if astSelectorMatchesNode(candidate, nested, node) {
          found = true
          return
        }
      }
    })
    return found
  case astSelectorChild:
    parent := selectorParent(node)
    return parent != nil &&
      astSelectorMatchesNode(node, selector.right, scopeRoot) &&
      astSelectorMatchesNode(parent, selector.left, scopeRoot)
  case astSelectorDescendant:
    if !astSelectorMatchesNode(node, selector.right, scopeRoot) {
      return false
    }
    for parent := selectorParent(node); parent != nil; parent = selectorParent(parent) {
      if astSelectorMatchesNode(parent, selector.left, scopeRoot) {
        return true
      }
      if scopeRoot != nil && parent == scopeRoot {
        break
      }
    }
    return false
  case astSelectorSibling:
    if astSelectorMatchesNode(node, selector.right, scopeRoot) {
      for _, sibling := range selectorSiblings(node, false) {
        if astSelectorMatchesNode(sibling, selector.left, scopeRoot) {
          return true
        }
      }
    }
    if selector.left != nil && selector.left.subject && astSelectorMatchesNode(node, selector.left, scopeRoot) {
      for _, sibling := range selectorSiblings(node, true) {
        if astSelectorMatchesNode(sibling, selector.right, scopeRoot) {
          return true
        }
      }
    }
    return false
  case astSelectorAdjacent:
    if astSelectorMatchesNode(node, selector.right, scopeRoot) {
      if sibling := selectorAdjacent(node, false); sibling != nil {
        return astSelectorMatchesNode(sibling, selector.left, scopeRoot)
      }
    }
    if selector.left != nil && selector.left.subject && astSelectorMatchesNode(node, selector.left, scopeRoot) {
      if sibling := selectorAdjacent(node, true); sibling != nil {
        return astSelectorMatchesNode(sibling, selector.right, scopeRoot)
      }
    }
    return false
  case astSelectorNthChild:
    return selectorChildIndex(node, false) == selector.index
  case astSelectorNthLastChild:
    return selectorChildIndex(node, true) == selector.index
  case astSelectorClass:
    return astSelectorMatchesClass(node, selector.name)
  }
  return false
}

func selectorParent(node *shimast.Node) *shimast.Node {
  if node == nil {
    return nil
  }
  return node.Parent
}

func selectorSiblings(node *shimast.Node, following bool) []*shimast.Node {
  children, index := selectorNodeListPosition(node)
  if index < 0 {
    return nil
  }
  if following {
    return children[index+1:]
  }
  return children[:index]
}

func selectorAdjacent(node *shimast.Node, following bool) *shimast.Node {
  siblings := selectorSiblings(node, following)
  if len(siblings) == 0 {
    return nil
  }
  if following {
    return siblings[0]
  }
  return siblings[len(siblings)-1]
}

func selectorChildIndex(node *shimast.Node, fromEnd bool) int {
  children, index := selectorNodeListPosition(node)
  if index < 0 {
    return 0
  }
  if fromEnd {
    return len(children) - index
  }
  return index + 1
}

// esquery defines sibling and child-position selectors only within array-valued
// visitor fields. Scalar children such as a call's callee are not siblings of
// entries in its arguments array. TypeScript-Go exposes traversal through
// ForEachChild, so recover the node-list boundaries from the structural fields
// supported by this selector adapter instead of flattening every child.
func selectorNodeListPosition(node *shimast.Node) ([]*shimast.Node, int) {
  parent := selectorParent(node)
  if parent == nil {
    return nil, -1
  }
  fields := [...]string{
    "body",
    "params",
    "arguments",
    "consequent",
    "declarations",
    "elements",
    "members",
    "properties",
    "statements",
  }
  for _, field := range fields {
    value := astSelectorNodeProperty(parent, field)
    if value.kind != astSelectorRuntimeNodes {
      continue
    }
    for index, candidate := range value.nodes {
      if candidate == node {
        return value.nodes, index
      }
    }
  }
  return nil, -1
}

func astSelectorMatchesNodeType(node *shimast.Node, requested string) bool {
  if node == nil {
    return false
  }
  native := strings.TrimPrefix(node.Kind.String(), "Kind")
  if strings.EqualFold(native, requested) {
    return true
  }
  switch strings.ToLower(requested) {
  case "program":
    return node.Kind == shimast.KindSourceFile
  case "arrowfunctionexpression":
    return node.Kind == shimast.KindArrowFunction
  case "objectexpression":
    return node.Kind == shimast.KindObjectLiteralExpression && !isDestructuringAssignmentTarget(node)
  case "arrayexpression":
    return node.Kind == shimast.KindArrayLiteralExpression && !isDestructuringAssignmentTarget(node)
  case "objectpattern":
    return node.Kind == shimast.KindObjectBindingPattern ||
      node.Kind == shimast.KindObjectLiteralExpression && isDestructuringAssignmentTarget(node)
  case "arraypattern":
    return node.Kind == shimast.KindArrayBindingPattern ||
      node.Kind == shimast.KindArrayLiteralExpression && isDestructuringAssignmentTarget(node)
  case "variabledeclarator":
    return node.Kind == shimast.KindVariableDeclaration
  case "memberexpression":
    return node.Kind == shimast.KindPropertyAccessExpression || node.Kind == shimast.KindElementAccessExpression
  case "assignmentexpression":
    if node.Kind != shimast.KindBinaryExpression {
      return false
    }
    expression := node.AsBinaryExpression()
    return expression != nil && expression.OperatorToken != nil &&
      isAssignmentOperator(expression.OperatorToken.Kind) &&
      !isDestructuringAssignmentTarget(node)
  case "logicalexpression":
    if node.Kind != shimast.KindBinaryExpression {
      return false
    }
    expression := node.AsBinaryExpression()
    if expression == nil || expression.OperatorToken == nil {
      return false
    }
    switch expression.OperatorToken.Kind {
    case shimast.KindAmpersandAmpersandToken, shimast.KindBarBarToken, shimast.KindQuestionQuestionToken:
      return true
    }
    return false
  case "updateexpression":
    if node.Kind == shimast.KindPrefixUnaryExpression {
      expression := node.AsPrefixUnaryExpression()
      return expression != nil && (expression.Operator == shimast.KindPlusPlusToken || expression.Operator == shimast.KindMinusMinusToken)
    }
    if node.Kind == shimast.KindPostfixUnaryExpression {
      expression := node.AsPostfixUnaryExpression()
      return expression != nil && (expression.Operator == shimast.KindPlusPlusToken || expression.Operator == shimast.KindMinusMinusToken)
    }
    return false
  case "unaryexpression":
    if node.Kind == shimast.KindPrefixUnaryExpression {
      expression := node.AsPrefixUnaryExpression()
      return expression != nil && expression.Operator != shimast.KindPlusPlusToken && expression.Operator != shimast.KindMinusMinusToken
    }
    return node.Kind == shimast.KindDeleteExpression ||
      node.Kind == shimast.KindTypeOfExpression ||
      node.Kind == shimast.KindVoidExpression
  case "literal":
    return astSelectorIsLiteral(node)
  case "thisexpression":
    return node.Kind == shimast.KindThisKeyword
  case "super":
    return node.Kind == shimast.KindSuperKeyword
  case "templateliteral":
    return node.Kind == shimast.KindTemplateExpression || node.Kind == shimast.KindNoSubstitutionTemplateLiteral
  case "property":
    switch node.Kind {
    case shimast.KindPropertyAssignment,
      shimast.KindShorthandPropertyAssignment:
      return true
    case shimast.KindBindingElement:
      element := node.AsBindingElement()
      return element != nil && element.DotDotDotToken == nil &&
        node.Parent != nil && node.Parent.Kind == shimast.KindObjectBindingPattern
    case shimast.KindMethodDeclaration,
      shimast.KindGetAccessor,
      shimast.KindSetAccessor:
      return node.Parent != nil && node.Parent.Kind == shimast.KindObjectLiteralExpression
    }
  case "spreadelement":
    return (node.Kind == shimast.KindSpreadElement || node.Kind == shimast.KindSpreadAssignment) &&
      !isDestructuringAssignmentTarget(node)
  case "restelement":
    if (node.Kind == shimast.KindSpreadElement || node.Kind == shimast.KindSpreadAssignment) &&
      isDestructuringAssignmentTarget(node) {
      return true
    }
    if node.Kind == shimast.KindBindingElement {
      element := node.AsBindingElement()
      return element != nil && element.DotDotDotToken != nil
    }
    if node.Kind == shimast.KindParameter {
      parameter := node.AsParameterDeclaration()
      return parameter != nil && parameter.DotDotDotToken != nil
    }
    return false
  case "tsasexpression":
    return node.Kind == shimast.KindAsExpression
  case "tstypeassertion":
    return node.Kind == shimast.KindTypeAssertionExpression
  case "tssatisfiesexpression":
    return node.Kind == shimast.KindSatisfiesExpression
  case "tsnonnullexpression":
    return node.Kind == shimast.KindNonNullExpression
  }
  return false
}

func astSelectorIsLiteral(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindNumericLiteral,
    shimast.KindBigIntLiteral,
    shimast.KindStringLiteral,
    shimast.KindRegularExpressionLiteral,
    shimast.KindTrueKeyword,
    shimast.KindFalseKeyword,
    shimast.KindNullKeyword:
    return true
  }
  return false
}

func astSelectorMatchesClass(node *shimast.Node, class string) bool {
  switch strings.ToLower(class) {
  case "statement":
    native := strings.TrimPrefix(node.Kind.String(), "Kind")
    return strings.HasSuffix(native, "Statement") || strings.HasSuffix(native, "Declaration")
  case "expression":
    return astSelectorIsExpression(node)
  case "declaration":
    return astSelectorIsDeclaration(node)
  case "function":
    return isFunctionLikeKind(node)
  case "pattern":
    return astSelectorIsPattern(node) || astSelectorIsExpression(node)
  default:
    return false
  }
}

func astSelectorIsExpression(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  if astSelectorIsLiteral(node) {
    return true
  }
  native := strings.TrimPrefix(node.Kind.String(), "Kind")
  if strings.HasSuffix(native, "Expression") || strings.HasSuffix(native, "Literal") {
    return true
  }
  switch node.Kind {
  case shimast.KindIdentifier:
    return node.Parent == nil || node.Parent.Kind != shimast.KindMetaProperty
  case shimast.KindPrivateIdentifier,
    shimast.KindMetaProperty,
    shimast.KindThisKeyword,
    shimast.KindSuperKeyword,
    shimast.KindArrowFunction:
    return true
  }
  return false
}

func astSelectorIsDeclaration(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  return strings.HasSuffix(strings.TrimPrefix(node.Kind.String(), "Kind"), "Declaration")
}

func astSelectorIsPattern(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  return strings.HasSuffix(strings.TrimPrefix(node.Kind.String(), "Kind"), "Pattern")
}

type astSelectorRuntimeValueKind uint8

const (
  astSelectorRuntimeMissing astSelectorRuntimeValueKind = iota
  astSelectorRuntimeNull
  astSelectorRuntimeString
  astSelectorRuntimeNumber
  astSelectorRuntimeBigInt
  astSelectorRuntimeBoolean
  astSelectorRuntimeObject
  astSelectorRuntimeNode
  astSelectorRuntimeNodes
)

type astSelectorRuntimeValue struct {
  kind    astSelectorRuntimeValueKind
  text    string
  number  float64
  boolean bool
  node    *shimast.Node
  nodes   []*shimast.Node
}

func astSelectorMatchesAttribute(node *shimast.Node, selector *astSelector) bool {
  value := astSelectorPathValue(astSelectorRuntimeValue{kind: astSelectorRuntimeNode, node: node}, strings.Split(selector.name, "."))
  if selector.operator == "" {
    return value.kind != astSelectorRuntimeMissing && value.kind != astSelectorRuntimeNull
  }
  matched := false
  switch selector.value.kind {
  case astSelectorValueRegexp:
    if selector.operator == "!=" {
      return selector.value.regexp == nil || !selector.value.regexp.MatchString(astSelectorRuntimeStringValue(value))
    }
    matched = value.kind == astSelectorRuntimeString && selector.value.regexp != nil && selector.value.regexp.MatchString(value.text)
  case astSelectorValueType:
    matched = selector.value.literal == astSelectorRuntimeType(value)
  case astSelectorValueLiteral:
    if selector.operator == "=" || selector.operator == "!=" {
      expected := selector.value.literal
      if selector.value.number != nil {
        expected = astSelectorNumberString(*selector.value.number)
      }
      matched = astSelectorRuntimeStringValue(value) == expected
    } else {
      return astSelectorCompare(value, selector.value, selector.operator)
    }
  default:
    return false
  }
  if selector.operator == "!=" {
    return !matched
  }
  return matched
}

func astSelectorCompare(value astSelectorRuntimeValue, expected astSelectorValue, operator string) bool {
  if left, stringValue := astSelectorRuntimeRelationalString(value); stringValue && expected.number == nil {
    comparison := astSelectorCompareUTF16(left, expected.literal)
    switch operator {
    case ">":
      return comparison > 0
    case ">=":
      return comparison >= 0
    case "<":
      return comparison < 0
    case "<=":
      return comparison <= 0
    }
    return false
  }
  if value.kind == astSelectorRuntimeBigInt {
    return astSelectorCompareBigInt(value.text, expected, operator)
  }
  left, leftNumber := astSelectorRuntimeNumberValue(value)
  right := 0.0
  rightNumber := false
  if expected.number != nil {
    right = *expected.number
    rightNumber = true
  } else if parsed, ok := astSelectorParseNumberString(expected.literal); ok {
    right = parsed
    rightNumber = true
  }
  if !leftNumber || !rightNumber || math.IsNaN(left) || math.IsNaN(right) {
    return false
  }
  switch operator {
  case ">":
    return left > right
  case ">=":
    return left >= right
  case "<":
    return left < right
  case "<=":
    return left <= right
  }
  return false
}

func astSelectorCompareUTF16(left, right string) int {
  leftUnits := utf16.Encode([]rune(left))
  rightUnits := utf16.Encode([]rune(right))
  length := len(leftUnits)
  if len(rightUnits) < length {
    length = len(rightUnits)
  }
  for index := 0; index < length; index++ {
    if leftUnits[index] < rightUnits[index] {
      return -1
    }
    if leftUnits[index] > rightUnits[index] {
      return 1
    }
  }
  switch {
  case len(leftUnits) < len(rightUnits):
    return -1
  case len(leftUnits) > len(rightUnits):
    return 1
  default:
    return 0
  }
}

func astSelectorRuntimeRelationalString(value astSelectorRuntimeValue) (string, bool) {
  switch value.kind {
  case astSelectorRuntimeString,
    astSelectorRuntimeObject,
    astSelectorRuntimeNode,
    astSelectorRuntimeNodes:
    return astSelectorRuntimeStringValue(value), true
  }
  return "", false
}

func astSelectorCompareBigInt(value string, expected astSelectorValue, operator string) bool {
  left, ok := new(big.Int).SetString(value, 10)
  if !ok {
    return false
  }
  right := new(big.Rat)
  comparison := 0
  if expected.number != nil {
    if math.IsNaN(*expected.number) {
      return false
    }
    if math.IsInf(*expected.number, 1) {
      comparison = -1
    } else if math.IsInf(*expected.number, -1) {
      comparison = 1
    } else {
      if right.SetFloat64(*expected.number) == nil {
        return false
      }
      comparison = new(big.Rat).SetInt(left).Cmp(right)
    }
  } else {
    integer, ok := astSelectorParseBigIntString(expected.literal)
    if !ok {
      return false
    }
    right.SetInt(integer)
    comparison = new(big.Rat).SetInt(left).Cmp(right)
  }
  switch operator {
  case ">":
    return comparison > 0
  case ">=":
    return comparison >= 0
  case "<":
    return comparison < 0
  case "<=":
    return comparison <= 0
  }
  return false
}

func astSelectorParseBigIntString(value string) (*big.Int, bool) {
  value = strings.TrimSpace(value)
  if value == "" {
    return new(big.Int), true
  }
  negative := false
  if value[0] == '+' || value[0] == '-' {
    negative = value[0] == '-'
    value = value[1:]
    if value == "" {
      return nil, false
    }
    lower := strings.ToLower(value)
    if strings.HasPrefix(lower, "0x") || strings.HasPrefix(lower, "0o") || strings.HasPrefix(lower, "0b") {
      return nil, false
    }
  }
  base := 10
  lower := strings.ToLower(value)
  switch {
  case strings.HasPrefix(lower, "0x"):
    base, value = 16, value[2:]
  case strings.HasPrefix(lower, "0o"):
    base, value = 8, value[2:]
  case strings.HasPrefix(lower, "0b"):
    base, value = 2, value[2:]
  }
  integer, ok := new(big.Int).SetString(value, base)
  if !ok {
    return nil, false
  }
  if negative {
    integer.Neg(integer)
  }
  return integer, true
}

func astSelectorRuntimeType(value astSelectorRuntimeValue) string {
  switch value.kind {
  case astSelectorRuntimeString:
    return "string"
  case astSelectorRuntimeNumber:
    return "number"
  case astSelectorRuntimeBigInt:
    return "bigint"
  case astSelectorRuntimeBoolean:
    return "boolean"
  case astSelectorRuntimeObject, astSelectorRuntimeNode, astSelectorRuntimeNodes, astSelectorRuntimeNull:
    return "object"
  default:
    return "undefined"
  }
}

func astSelectorRuntimeStringValue(value astSelectorRuntimeValue) string {
  switch value.kind {
  case astSelectorRuntimeString:
    return value.text
  case astSelectorRuntimeNumber:
    return astSelectorNumberString(value.number)
  case astSelectorRuntimeBigInt:
    return value.text
  case astSelectorRuntimeBoolean:
    return strconv.FormatBool(value.boolean)
  case astSelectorRuntimeNull:
    return "null"
  case astSelectorRuntimeMissing:
    return "undefined"
  case astSelectorRuntimeNodes:
    if len(value.nodes) == 0 {
      return ""
    }
    return strings.TrimSuffix(strings.Repeat("[object Object],", len(value.nodes)), ",")
  case astSelectorRuntimeObject:
    if value.text != "" {
      return value.text
    }
  }
  return "[object Object]"
}

func astSelectorRuntimeNumberValue(value astSelectorRuntimeValue) (float64, bool) {
  switch value.kind {
  case astSelectorRuntimeNumber:
    return value.number, true
  case astSelectorRuntimeString:
    return astSelectorParseNumberString(value.text)
  case astSelectorRuntimeBoolean:
    if value.boolean {
      return 1, true
    }
    return 0, true
  case astSelectorRuntimeNull:
    return 0, true
  case astSelectorRuntimeObject,
    astSelectorRuntimeNode,
    astSelectorRuntimeNodes:
    return astSelectorParseNumberString(astSelectorRuntimeStringValue(value))
  }
  return 0, false
}

func astSelectorNumberString(value float64) string {
  if math.IsInf(value, 1) {
    return "Infinity"
  }
  if math.IsInf(value, -1) {
    return "-Infinity"
  }
  if math.IsNaN(value) {
    return "NaN"
  }
  if value == 0 {
    return "0"
  }
  formatted := strconv.FormatFloat(value, 'g', -1, 64)
  exponentAt := strings.IndexByte(formatted, 'e')
  if exponentAt < 0 {
    return formatted
  }
  mantissa := formatted[:exponentAt]
  exponent, err := strconv.Atoi(formatted[exponentAt+1:])
  if err != nil {
    return formatted
  }
  sign := ""
  if strings.HasPrefix(mantissa, "-") {
    sign = "-"
    mantissa = mantissa[1:]
  }
  if exponent >= -6 && exponent < 21 {
    digits := strings.ReplaceAll(mantissa, ".", "")
    decimal := exponent + 1
    switch {
    case decimal <= 0:
      return sign + "0." + strings.Repeat("0", -decimal) + digits
    case decimal >= len(digits):
      return sign + digits + strings.Repeat("0", decimal-len(digits))
    default:
      return sign + digits[:decimal] + "." + digits[decimal:]
    }
  }
  exponentSign := "+"
  if exponent < 0 {
    exponentSign = ""
  }
  return sign + mantissa + "e" + exponentSign + strconv.Itoa(exponent)
}

func astSelectorParseNumberString(value string) (float64, bool) {
  value = strings.TrimSpace(value)
  if value == "" {
    return 0, true
  }
  switch value {
  case "Infinity", "+Infinity":
    return math.Inf(1), true
  case "-Infinity":
    return math.Inf(-1), true
  }
  lower := strings.ToLower(value)
  switch lower {
  case "inf", "+inf", "-inf", "infinity", "+infinity", "-infinity":
    return 0, false
  }
  if strings.ContainsRune(value, '_') {
    return 0, false
  }
  if len(lower) > 1 && (lower[0] == '+' || lower[0] == '-') {
    unsigned := lower[1:]
    if strings.HasPrefix(unsigned, "0x") || strings.HasPrefix(unsigned, "0o") || strings.HasPrefix(unsigned, "0b") {
      return 0, false
    }
  }
  base := 0
  switch {
  case strings.HasPrefix(lower, "0x"):
    base = 16
  case strings.HasPrefix(lower, "0o"):
    base = 8
  case strings.HasPrefix(lower, "0b"):
    base = 2
  }
  if base != 0 {
    digits := value[2:]
    if digits == "" || digits[0] == '+' || digits[0] == '-' || strings.ContainsRune(digits, '_') {
      return 0, false
    }
    integer, ok := new(big.Int).SetString(digits, base)
    if !ok {
      return 0, false
    }
    number, _ := new(big.Float).SetInt(integer).Float64()
    return number, true
  }
  number, err := strconv.ParseFloat(value, 64)
  return number, err == nil || errors.Is(err, strconv.ErrRange)
}

func astSelectorPathValue(value astSelectorRuntimeValue, path []string) astSelectorRuntimeValue {
  current := value
  for _, field := range path {
    switch current.kind {
    case astSelectorRuntimeNode:
      current = astSelectorNodeProperty(current.node, field)
    case astSelectorRuntimeNodes:
      if field == "length" {
        current = astSelectorRuntimeValue{kind: astSelectorRuntimeNumber, number: float64(len(current.nodes))}
        continue
      }
      index, err := strconv.Atoi(field)
      if err != nil || index < 0 || strconv.Itoa(index) != field || index >= len(current.nodes) {
        return astSelectorRuntimeValue{}
      }
      current = astSelectorNode(current.nodes[index])
    case astSelectorRuntimeString:
      if field != "length" {
        return astSelectorRuntimeValue{}
      }
      current = astSelectorRuntimeValue{
        kind:   astSelectorRuntimeNumber,
        number: float64(len(utf16.Encode([]rune(current.text)))),
      }
    case astSelectorRuntimeNull:
      return current
    default:
      return astSelectorRuntimeValue{}
    }
  }
  return current
}

func astSelectorMatchesField(node *shimast.Node, name string) bool {
  path := strings.Split(name, ".")
  ancestor := node
  for range path {
    ancestor = selectorParent(ancestor)
    if ancestor == nil {
      return false
    }
  }
  return astSelectorNodeInPath(node, astSelectorRuntimeValue{kind: astSelectorRuntimeNode, node: ancestor}, path)
}

func astSelectorNodeInPath(node *shimast.Node, value astSelectorRuntimeValue, path []string) bool {
  if len(path) == 0 {
    return value.kind == astSelectorRuntimeNode && value.node == node
  }
  if value.kind != astSelectorRuntimeNode {
    return false
  }
  next := astSelectorNodeProperty(value.node, path[0])
  if next.kind == astSelectorRuntimeNodes {
    for _, child := range next.nodes {
      if astSelectorNodeInPath(node, astSelectorRuntimeValue{kind: astSelectorRuntimeNode, node: child}, path[1:]) {
        return true
      }
    }
    return false
  }
  return astSelectorNodeInPath(node, next, path[1:])
}

func astSelectorNodeProperty(node *shimast.Node, field string) astSelectorRuntimeValue {
  if node == nil {
    return astSelectorRuntimeValue{kind: astSelectorRuntimeNull}
  }
  switch field {
  case "type":
    return astSelectorString(strings.TrimPrefix(node.Kind.String(), "Kind"))
  case "name":
    if name := identifierText(node); name != "" {
      return astSelectorString(name)
    }
    if node.Kind == shimast.KindPrivateIdentifier {
      return astSelectorString(node.AsPrivateIdentifier().Text)
    }
    nameNode := node.Name()
    if name := identifierText(nameNode); name != "" {
      return astSelectorString(name)
    }
    if nameNode != nil && nameNode.Kind == shimast.KindPrivateIdentifier {
      return astSelectorString(nameNode.AsPrivateIdentifier().Text)
    }
    if value := astSelectorLiteralValue(nameNode); value.kind != astSelectorRuntimeMissing {
      return value
    }
    return astSelectorRuntimeValue{kind: astSelectorRuntimeNull}
  case "value":
    if node.Kind == shimast.KindPropertyAssignment {
      return astSelectorNode(node.AsPropertyAssignment().Initializer)
    }
    if node.Kind == shimast.KindShorthandPropertyAssignment {
      return astSelectorNode(node.AsShorthandPropertyAssignment().Name())
    }
    if node.Kind == shimast.KindBindingElement {
      return astSelectorNode(node.Name())
    }
    return astSelectorLiteralValue(node)
  case "raw":
    if astSelectorIsLiteral(node) || node.Kind == shimast.KindNoSubstitutionTemplateLiteral {
      if file := shimast.GetSourceFileOfNode(node); file != nil {
        return astSelectorString(nodeText(file, node))
      }
    }
    return astSelectorRuntimeValue{}
  case "operator":
    if operator := astSelectorNodeOperator(node); operator != "" {
      return astSelectorString(operator)
    }
    return astSelectorRuntimeValue{}
  case "kind":
    if kind := astSelectorVariableKind(node); kind != "" {
      return astSelectorString(kind)
    }
    return astSelectorRuntimeValue{}
  case "async":
    if node.FunctionLikeData() == nil {
      return astSelectorRuntimeValue{}
    }
    return astSelectorBoolean(hasModifier(node, shimast.KindAsyncKeyword))
  case "generator":
    if node.FunctionLikeData() == nil {
      return astSelectorRuntimeValue{}
    }
    return astSelectorBoolean(astSelectorIsGenerator(node))
  case "static":
    if !astSelectorSupportsStatic(node) {
      return astSelectorRuntimeValue{}
    }
    if node.Kind == shimast.KindClassStaticBlockDeclaration {
      return astSelectorBoolean(true)
    }
    return astSelectorBoolean(hasModifier(node, shimast.KindStaticKeyword))
  case "readonly":
    if !astSelectorSupportsReadonly(node) {
      return astSelectorRuntimeValue{}
    }
    return astSelectorBoolean(hasModifier(node, shimast.KindReadonlyKeyword))
  case "declare":
    declared, applicable := astSelectorIsDeclared(node)
    if !applicable {
      return astSelectorRuntimeValue{}
    }
    return astSelectorBoolean(declared)
  case "optional":
    optional, applicable := astSelectorIsOptional(node)
    if !applicable {
      return astSelectorRuntimeValue{}
    }
    return astSelectorBoolean(optional)
  case "computed":
    computed, applicable := astSelectorIsComputed(node)
    if !applicable {
      return astSelectorRuntimeValue{}
    }
    return astSelectorBoolean(computed)
  case "prefix":
    switch node.Kind {
    case shimast.KindPrefixUnaryExpression,
      shimast.KindDeleteExpression,
      shimast.KindTypeOfExpression,
      shimast.KindVoidExpression:
      return astSelectorBoolean(true)
    case shimast.KindPostfixUnaryExpression:
      return astSelectorBoolean(false)
    }
    return astSelectorRuntimeValue{}
  case "id":
    return astSelectorNode(node.Name())
  case "params":
    if function := node.FunctionLikeData(); function != nil && function.Parameters != nil {
      return astSelectorNodes(function.Parameters.Nodes)
    }
  case "body":
    if body := node.Body(); body != nil {
      return astSelectorNode(body)
    }
    return astSelectorStatementBody(node)
  case "callee":
    if node.Kind == shimast.KindCallExpression {
      if call := node.AsCallExpression(); call != nil {
        return astSelectorNode(call.Expression)
      }
    }
    if node.Kind == shimast.KindNewExpression {
      if expression := node.AsNewExpression(); expression != nil {
        return astSelectorNode(expression.Expression)
      }
    }
  case "arguments":
    if node.Kind == shimast.KindCallExpression {
      if call := node.AsCallExpression(); call != nil && call.Arguments != nil {
        return astSelectorNodes(call.Arguments.Nodes)
      }
    }
    if node.Kind == shimast.KindNewExpression {
      if expression := node.AsNewExpression(); expression != nil && expression.Arguments != nil {
        return astSelectorNodes(expression.Arguments.Nodes)
      }
    }
  case "object":
    if node.Kind == shimast.KindPropertyAccessExpression {
      return astSelectorNode(node.AsPropertyAccessExpression().Expression)
    }
    if node.Kind == shimast.KindElementAccessExpression {
      return astSelectorNode(node.AsElementAccessExpression().Expression)
    }
  case "property":
    if node.Kind == shimast.KindPropertyAccessExpression {
      return astSelectorNode(node.AsPropertyAccessExpression().Name())
    }
    if node.Kind == shimast.KindElementAccessExpression {
      return astSelectorNode(node.AsElementAccessExpression().ArgumentExpression)
    }
  case "left":
    if node.Kind == shimast.KindBinaryExpression {
      return astSelectorNode(node.AsBinaryExpression().Left)
    }
    if node.Kind == shimast.KindQualifiedName {
      return astSelectorNode(node.AsQualifiedName().Left)
    }
  case "right":
    if node.Kind == shimast.KindBinaryExpression {
      return astSelectorNode(node.AsBinaryExpression().Right)
    }
    if node.Kind == shimast.KindQualifiedName {
      return astSelectorNode(node.AsQualifiedName().Right)
    }
  case "argument":
    return astSelectorUnaryArgument(node)
  case "expression":
    return astSelectorExpressionChild(node)
  case "test":
    return astSelectorTestChild(node)
  case "consequent":
    if node.Kind == shimast.KindIfStatement {
      return astSelectorNode(node.AsIfStatement().ThenStatement)
    }
    if node.Kind == shimast.KindConditionalExpression {
      return astSelectorNode(node.AsConditionalExpression().WhenTrue)
    }
    if node.Kind == shimast.KindCaseClause || node.Kind == shimast.KindDefaultClause {
      clause := node.AsCaseOrDefaultClause()
      if clause != nil && clause.Statements != nil {
        return astSelectorNodes(clause.Statements.Nodes)
      }
    }
  case "alternate":
    if node.Kind == shimast.KindIfStatement {
      return astSelectorNode(node.AsIfStatement().ElseStatement)
    }
    if node.Kind == shimast.KindConditionalExpression {
      return astSelectorNode(node.AsConditionalExpression().WhenFalse)
    }
  case "init":
    if node.Kind == shimast.KindVariableDeclaration {
      return astSelectorNode(node.AsVariableDeclaration().Initializer)
    }
    if node.Kind == shimast.KindForStatement {
      return astSelectorNode(node.AsForStatement().Initializer)
    }
  case "update":
    if node.Kind == shimast.KindForStatement {
      return astSelectorNode(node.AsForStatement().Incrementor)
    }
  case "declarations":
    if node.Kind == shimast.KindVariableDeclarationList {
      list := node.AsVariableDeclarationList()
      if list != nil && list.Declarations != nil {
        return astSelectorNodes(list.Declarations.Nodes)
      }
    }
    if node.Kind == shimast.KindVariableStatement {
      statement := node.AsVariableStatement()
      if statement != nil && statement.DeclarationList != nil {
        list := statement.DeclarationList.AsVariableDeclarationList()
        if list != nil && list.Declarations != nil {
          return astSelectorNodes(list.Declarations.Nodes)
        }
      }
    }
  case "elements":
    if node.Kind == shimast.KindArrayLiteralExpression {
      expression := node.AsArrayLiteralExpression()
      if expression != nil && expression.Elements != nil {
        return astSelectorNodes(expression.Elements.Nodes)
      }
    }
    if node.Kind == shimast.KindObjectBindingPattern || node.Kind == shimast.KindArrayBindingPattern {
      pattern := node.AsBindingPattern()
      if pattern != nil && pattern.Elements != nil {
        return astSelectorNodes(pattern.Elements.Nodes)
      }
    }
  case "properties":
    if node.Kind == shimast.KindObjectLiteralExpression {
      expression := node.AsObjectLiteralExpression()
      if expression != nil && expression.Properties != nil {
        return astSelectorNodes(expression.Properties.Nodes)
      }
    }
    if node.Kind == shimast.KindObjectBindingPattern {
      pattern := node.AsBindingPattern()
      if pattern != nil && pattern.Elements != nil {
        return astSelectorNodes(pattern.Elements.Nodes)
      }
    }
  case "members":
    switch node.Kind {
    case shimast.KindClassDeclaration,
      shimast.KindClassExpression,
      shimast.KindInterfaceDeclaration,
      shimast.KindEnumDeclaration,
      shimast.KindTypeLiteral,
      shimast.KindMappedType:
      return astSelectorNodes(node.Members())
    }
  case "key":
    return astSelectorPropertyKey(node)
  case "source":
    if node.Kind == shimast.KindImportDeclaration {
      return astSelectorNode(node.AsImportDeclaration().ModuleSpecifier)
    }
    if node.Kind == shimast.KindExportDeclaration {
      return astSelectorNode(node.AsExportDeclaration().ModuleSpecifier)
    }
  case "statements":
    return astSelectorStatements(node)
  }
  return astSelectorRuntimeValue{}
}

func astSelectorString(value string) astSelectorRuntimeValue {
  return astSelectorRuntimeValue{kind: astSelectorRuntimeString, text: value}
}

func astSelectorBoolean(value bool) astSelectorRuntimeValue {
  return astSelectorRuntimeValue{kind: astSelectorRuntimeBoolean, boolean: value}
}

func astSelectorLiteralValue(node *shimast.Node) astSelectorRuntimeValue {
  if node == nil {
    return astSelectorRuntimeValue{kind: astSelectorRuntimeNull}
  }
  switch node.Kind {
  case shimast.KindStringLiteral, shimast.KindNoSubstitutionTemplateLiteral:
    if data := node.LiteralLikeData(); data != nil {
      return astSelectorString(data.Text)
    }
  case shimast.KindRegularExpressionLiteral:
    if file := shimast.GetSourceFileOfNode(node); file != nil {
      return astSelectorRuntimeValue{kind: astSelectorRuntimeObject, text: astSelectorRegexpString(nodeText(file, node))}
    }
    return astSelectorRuntimeValue{kind: astSelectorRuntimeObject}
  case shimast.KindNumericLiteral:
    if data := node.LiteralLikeData(); data != nil {
      text := strings.ReplaceAll(data.Text, "_", "")
      if number, err := strconv.ParseFloat(text, 64); err == nil || errors.Is(err, strconv.ErrRange) {
        return astSelectorRuntimeValue{kind: astSelectorRuntimeNumber, number: number}
      }
      if integer, ok := new(big.Int).SetString(text, 0); ok {
        number, _ := new(big.Float).SetInt(integer).Float64()
        return astSelectorRuntimeValue{kind: astSelectorRuntimeNumber, number: number}
      }
    }
  case shimast.KindBigIntLiteral:
    if data := node.LiteralLikeData(); data != nil {
      text := strings.TrimSuffix(strings.ReplaceAll(data.Text, "_", ""), "n")
      if integer, ok := new(big.Int).SetString(text, 0); ok {
        text = integer.String()
      }
      return astSelectorRuntimeValue{
        kind: astSelectorRuntimeBigInt,
        text: text,
      }
    }
  case shimast.KindTrueKeyword:
    return astSelectorBoolean(true)
  case shimast.KindFalseKeyword:
    return astSelectorBoolean(false)
  case shimast.KindNullKeyword:
    return astSelectorRuntimeValue{kind: astSelectorRuntimeNull}
  }
  return astSelectorRuntimeValue{}
}

func astSelectorRegexpString(raw string) string {
  delimiter := strings.LastIndexByte(raw, '/')
  if delimiter <= 0 || delimiter == len(raw)-1 {
    return raw
  }
  flags := raw[delimiter+1:]
  var canonical strings.Builder
  for _, flag := range "dgimsuvy" {
    if strings.ContainsRune(flags, flag) {
      canonical.WriteRune(flag)
    }
  }
  if canonical.Len() != len(flags) {
    return raw
  }
  return raw[:delimiter+1] + canonical.String()
}

func astSelectorNode(node *shimast.Node) astSelectorRuntimeValue {
  if node == nil {
    return astSelectorRuntimeValue{kind: astSelectorRuntimeNull}
  }
  return astSelectorRuntimeValue{kind: astSelectorRuntimeNode, node: node}
}

func astSelectorNodes(nodes []*shimast.Node) astSelectorRuntimeValue {
  if nodes == nil {
    return astSelectorRuntimeValue{kind: astSelectorRuntimeNull}
  }
  return astSelectorRuntimeValue{kind: astSelectorRuntimeNodes, nodes: nodes}
}

func astSelectorNodeOperator(node *shimast.Node) string {
  if node == nil {
    return ""
  }
  kind := shimast.KindUnknown
  switch node.Kind {
  case shimast.KindBinaryExpression:
    if expression := node.AsBinaryExpression(); expression != nil && expression.OperatorToken != nil {
      kind = expression.OperatorToken.Kind
    }
  case shimast.KindPrefixUnaryExpression:
    kind = node.AsPrefixUnaryExpression().Operator
  case shimast.KindPostfixUnaryExpression:
    kind = node.AsPostfixUnaryExpression().Operator
  case shimast.KindDeleteExpression:
    return "delete"
  case shimast.KindTypeOfExpression:
    return "typeof"
  case shimast.KindVoidExpression:
    return "void"
  }
  return astSelectorOperatorText(kind)
}

func astSelectorOperatorText(kind shimast.Kind) string {
  return shimscanner.TokenToString(kind)
}

func astSelectorVariableKind(node *shimast.Node) string {
  if node == nil {
    return ""
  }
  list := node
  if node.Kind == shimast.KindVariableStatement {
    statement := node.AsVariableStatement()
    if statement == nil {
      return ""
    }
    list = statement.DeclarationList
  } else if node.Kind == shimast.KindVariableDeclaration {
    list = node.Parent
  }
  if list == nil || list.Kind != shimast.KindVariableDeclarationList {
    return ""
  }
  flags := list.Flags & shimast.NodeFlagsBlockScoped
  switch flags {
  case shimast.NodeFlagsLet:
    return "let"
  case shimast.NodeFlagsConst:
    return "const"
  case shimast.NodeFlagsUsing:
    return "using"
  case shimast.NodeFlagsAwaitUsing:
    return "await using"
  default:
    return "var"
  }
}

func astSelectorIsGenerator(node *shimast.Node) bool {
  if node == nil || !isFunctionLikeKind(node) {
    return false
  }
  body := node.BodyData()
  return body != nil && body.AsteriskToken != nil
}

func astSelectorIsOptional(node *shimast.Node) (bool, bool) {
  if node == nil {
    return false, false
  }
  switch node.Kind {
  case shimast.KindPropertyAccessExpression:
    return node.AsPropertyAccessExpression().QuestionDotToken != nil, true
  case shimast.KindElementAccessExpression:
    return node.AsElementAccessExpression().QuestionDotToken != nil, true
  case shimast.KindCallExpression:
    return node.AsCallExpression().QuestionDotToken != nil, true
  case shimast.KindTaggedTemplateExpression:
    return node.AsTaggedTemplateExpression().QuestionDotToken != nil, true
  case shimast.KindParameter,
    shimast.KindNamedTupleMember,
    shimast.KindMethodDeclaration,
    shimast.KindShorthandPropertyAssignment,
    shimast.KindMethodSignature,
    shimast.KindPropertySignature,
    shimast.KindPropertyAssignment,
    shimast.KindPropertyDeclaration,
    shimast.KindEnumMember,
    shimast.KindGetAccessor,
    shimast.KindSetAccessor:
    return node.QuestionToken() != nil, true
  }
  return false, false
}

func astSelectorSupportsStatic(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindClassStaticBlockDeclaration:
    return true
  case shimast.KindPropertyDeclaration,
    shimast.KindMethodDeclaration,
    shimast.KindGetAccessor,
    shimast.KindSetAccessor:
    return node.Parent != nil &&
      (node.Parent.Kind == shimast.KindClassDeclaration || node.Parent.Kind == shimast.KindClassExpression)
  }
  return false
}

func astSelectorSupportsReadonly(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindParameter,
    shimast.KindPropertyDeclaration,
    shimast.KindPropertySignature,
    shimast.KindIndexSignature:
    return true
  }
  return false
}

func astSelectorIsDeclared(node *shimast.Node) (bool, bool) {
  if node == nil {
    return false, false
  }
  declaration := node
  if node.Kind == shimast.KindVariableDeclaration {
    declaration = node.Parent
  }
  if declaration != nil && declaration.Kind == shimast.KindVariableDeclarationList {
    declaration = declaration.Parent
  }
  if declaration != nil && declaration.Kind == shimast.KindVariableStatement {
    return hasModifier(declaration, shimast.KindDeclareKeyword), true
  }
  if !astSelectorIsDeclaration(node) {
    return false, false
  }
  return hasModifier(node, shimast.KindDeclareKeyword), true
}

func astSelectorIsComputed(node *shimast.Node) (bool, bool) {
  if node == nil {
    return false, false
  }
  switch node.Kind {
  case shimast.KindElementAccessExpression, shimast.KindComputedPropertyName:
    return true, true
  case shimast.KindPropertyAccessExpression:
    return false, true
  case shimast.KindBindingElement:
    element := node.AsBindingElement()
    return element != nil && element.PropertyName != nil && element.PropertyName.Kind == shimast.KindComputedPropertyName, true
  case shimast.KindPropertyAssignment,
    shimast.KindShorthandPropertyAssignment,
    shimast.KindMethodDeclaration,
    shimast.KindMethodSignature,
    shimast.KindGetAccessor,
    shimast.KindSetAccessor,
    shimast.KindPropertyDeclaration,
    shimast.KindPropertySignature,
    shimast.KindEnumMember:
    name := node.Name()
    return name != nil && name.Kind == shimast.KindComputedPropertyName, true
  }
  return false, false
}

func astSelectorStatementBody(node *shimast.Node) astSelectorRuntimeValue {
  if node == nil {
    return astSelectorRuntimeValue{}
  }
  switch node.Kind {
  case shimast.KindSourceFile:
    file := node.AsSourceFile()
    if file != nil && file.Statements != nil {
      return astSelectorNodes(file.Statements.Nodes)
    }
  case shimast.KindBlock:
    block := node.AsBlock()
    if block != nil && block.Statements != nil {
      return astSelectorNodes(block.Statements.Nodes)
    }
  case shimast.KindModuleBlock:
    block := node.AsModuleBlock()
    if block != nil && block.Statements != nil {
      return astSelectorNodes(block.Statements.Nodes)
    }
  case shimast.KindCatchClause:
    if clause := node.AsCatchClause(); clause != nil {
      return astSelectorNode(clause.Block)
    }
  case shimast.KindLabeledStatement:
    if statement := node.AsLabeledStatement(); statement != nil {
      return astSelectorNode(statement.Statement)
    }
  case shimast.KindClassStaticBlockDeclaration:
    if block := node.AsClassStaticBlockDeclaration(); block != nil {
      return astSelectorNode(block.Body)
    }
  case shimast.KindIfStatement:
    return astSelectorNode(node.AsIfStatement().ThenStatement)
  case shimast.KindWhileStatement:
    return astSelectorNode(node.AsWhileStatement().Statement)
  case shimast.KindDoStatement:
    return astSelectorNode(node.AsDoStatement().Statement)
  case shimast.KindForStatement:
    return astSelectorNode(node.AsForStatement().Statement)
  case shimast.KindForInStatement, shimast.KindForOfStatement:
    return astSelectorNode(node.AsForInOrOfStatement().Statement)
  case shimast.KindWithStatement:
    return astSelectorNode(node.AsWithStatement().Statement)
  }
  return astSelectorRuntimeValue{}
}

func astSelectorUnaryArgument(node *shimast.Node) astSelectorRuntimeValue {
  if node == nil {
    return astSelectorRuntimeValue{}
  }
  switch node.Kind {
  case shimast.KindPrefixUnaryExpression:
    return astSelectorNode(node.AsPrefixUnaryExpression().Operand)
  case shimast.KindPostfixUnaryExpression:
    return astSelectorNode(node.AsPostfixUnaryExpression().Operand)
  case shimast.KindDeleteExpression:
    return astSelectorNode(node.AsDeleteExpression().Expression)
  case shimast.KindTypeOfExpression:
    return astSelectorNode(node.AsTypeOfExpression().Expression)
  case shimast.KindVoidExpression:
    return astSelectorNode(node.AsVoidExpression().Expression)
  case shimast.KindAwaitExpression:
    return astSelectorNode(node.AsAwaitExpression().Expression)
  case shimast.KindYieldExpression:
    return astSelectorNode(node.AsYieldExpression().Expression)
  case shimast.KindReturnStatement:
    return astSelectorNode(node.AsReturnStatement().Expression)
  case shimast.KindThrowStatement:
    return astSelectorNode(node.AsThrowStatement().Expression)
  case shimast.KindSpreadElement:
    return astSelectorNode(node.AsSpreadElement().Expression)
  case shimast.KindSpreadAssignment:
    return astSelectorNode(node.AsSpreadAssignment().Expression)
  case shimast.KindBindingElement:
    element := node.AsBindingElement()
    if element != nil && element.DotDotDotToken != nil {
      return astSelectorNode(element.Name())
    }
  case shimast.KindParameter:
    parameter := node.AsParameterDeclaration()
    if parameter != nil && parameter.DotDotDotToken != nil {
      return astSelectorNode(parameter.Name())
    }
  }
  return astSelectorRuntimeValue{}
}

func astSelectorExpressionChild(node *shimast.Node) astSelectorRuntimeValue {
  if node == nil {
    return astSelectorRuntimeValue{}
  }
  switch node.Kind {
  case shimast.KindPropertyAccessExpression,
    shimast.KindElementAccessExpression,
    shimast.KindParenthesizedExpression,
    shimast.KindCallExpression,
    shimast.KindNewExpression,
    shimast.KindExpressionWithTypeArguments,
    shimast.KindComputedPropertyName,
    shimast.KindNonNullExpression,
    shimast.KindTypeAssertionExpression,
    shimast.KindAsExpression,
    shimast.KindSatisfiesExpression,
    shimast.KindTypeOfExpression,
    shimast.KindSpreadAssignment,
    shimast.KindSpreadElement,
    shimast.KindTemplateSpan,
    shimast.KindDeleteExpression,
    shimast.KindVoidExpression,
    shimast.KindAwaitExpression,
    shimast.KindYieldExpression,
    shimast.KindPartiallyEmittedExpression,
    shimast.KindIfStatement,
    shimast.KindDoStatement,
    shimast.KindWhileStatement,
    shimast.KindWithStatement,
    shimast.KindForInStatement,
    shimast.KindForOfStatement,
    shimast.KindSwitchStatement,
    shimast.KindCaseClause,
    shimast.KindExpressionStatement,
    shimast.KindReturnStatement,
    shimast.KindThrowStatement,
    shimast.KindExternalModuleReference,
    shimast.KindExportAssignment,
    shimast.KindDecorator,
    shimast.KindJsxExpression,
    shimast.KindJsxSpreadAttribute:
    return astSelectorNode(node.Expression())
  }
  return astSelectorRuntimeValue{}
}

func astSelectorTestChild(node *shimast.Node) astSelectorRuntimeValue {
  if node == nil {
    return astSelectorRuntimeValue{}
  }
  switch node.Kind {
  case shimast.KindIfStatement:
    return astSelectorNode(node.AsIfStatement().Expression)
  case shimast.KindWhileStatement:
    return astSelectorNode(node.AsWhileStatement().Expression)
  case shimast.KindDoStatement:
    return astSelectorNode(node.AsDoStatement().Expression)
  case shimast.KindForStatement:
    return astSelectorNode(node.AsForStatement().Condition)
  case shimast.KindConditionalExpression:
    return astSelectorNode(node.AsConditionalExpression().Condition)
  case shimast.KindCaseClause:
    clause := node.AsCaseOrDefaultClause()
    if clause != nil {
      return astSelectorNode(clause.Expression)
    }
  }
  return astSelectorRuntimeValue{}
}

func astSelectorPropertyKey(node *shimast.Node) astSelectorRuntimeValue {
  if node == nil {
    return astSelectorRuntimeValue{}
  }
  switch node.Kind {
  case shimast.KindPropertyAssignment:
    return astSelectorNode(node.AsPropertyAssignment().Name())
  case shimast.KindShorthandPropertyAssignment:
    return astSelectorNode(node.AsShorthandPropertyAssignment().Name())
  case shimast.KindBindingElement:
    element := node.AsBindingElement()
    if element.PropertyName != nil {
      return astSelectorNode(element.PropertyName)
    }
    return astSelectorNode(element.Name())
  }
  return astSelectorNode(node.Name())
}

func astSelectorStatements(node *shimast.Node) astSelectorRuntimeValue {
  if node == nil {
    return astSelectorRuntimeValue{}
  }
  switch node.Kind {
  case shimast.KindSourceFile:
    file := node.AsSourceFile()
    if file != nil && file.Statements != nil {
      return astSelectorNodes(file.Statements.Nodes)
    }
  case shimast.KindBlock:
    block := node.AsBlock()
    if block != nil && block.Statements != nil {
      return astSelectorNodes(block.Statements.Nodes)
    }
  case shimast.KindModuleBlock:
    block := node.AsModuleBlock()
    if block != nil && block.Statements != nil {
      return astSelectorNodes(block.Statements.Nodes)
    }
  case shimast.KindCaseClause, shimast.KindDefaultClause:
    clause := node.AsCaseOrDefaultClause()
    if clause != nil && clause.Statements != nil {
      return astSelectorNodes(clause.Statements.Nodes)
    }
  }
  return astSelectorRuntimeValue{}
}
