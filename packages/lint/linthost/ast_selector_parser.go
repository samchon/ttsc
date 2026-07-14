package linthost

import (
  "fmt"
  "regexp"
  "strconv"
  "strings"
  "unicode"
)

type astSelectorKind uint8

const (
  astSelectorWildcard astSelectorKind = iota
  astSelectorNodeType
  astSelectorExactNode
  astSelectorAttribute
  astSelectorField
  astSelectorMatches
  astSelectorCompound
  astSelectorNot
  astSelectorHas
  astSelectorChild
  astSelectorDescendant
  astSelectorSibling
  astSelectorAdjacent
  astSelectorNthChild
  astSelectorNthLastChild
  astSelectorClass
)

type astSelector struct {
  kind      astSelectorKind
  name      string
  operator  string
  value     astSelectorValue
  selectors []*astSelector
  left      *astSelector
  right     *astSelector
  index     int
  subject   bool
}

type astSelectorValueKind uint8

const (
  astSelectorValueMissing astSelectorValueKind = iota
  astSelectorValueLiteral
  astSelectorValueType
  astSelectorValueRegexp
)

type astSelectorValue struct {
  kind    astSelectorValueKind
  literal string
  number  *float64
  regexp  *regexp.Regexp
}

// parseASTSelector parses the selector language documented by esquery. The
// matcher runs over TypeScript-Go's AST rather than ESTree, but the grammar is
// intentionally the same: node types, attributes, fields, combinators,
// :not/:is/:matches/:has, child-position pseudos, classes, and subjects.
func parseASTSelector(source string) (*astSelector, error) {
  parser := &astSelectorParser{source: source}
  parser.skipSpace()
  if parser.eof() {
    return nil, fmt.Errorf("selector must not be empty")
  }
  selector, err := parser.parseSelectorList(0)
  if err != nil {
    return nil, err
  }
  parser.skipSpace()
  if !parser.eof() {
    return nil, parser.errorf("unexpected %q", parser.peek())
  }
  return selector, nil
}

type astSelectorParser struct {
  source string
  offset int
}

func (p *astSelectorParser) parseSelectorList(stop byte) (*astSelector, error) {
  selectors := make([]*astSelector, 0, 1)
  for {
    p.skipSpace()
    if p.eof() || stop != 0 && p.peek() == stop {
      if len(selectors) == 0 {
        return nil, p.errorf("expected selector")
      }
      break
    }
    selector, err := p.parseSelector()
    if err != nil {
      return nil, err
    }
    selectors = append(selectors, selector)
    p.skipSpace()
    if p.eof() || stop != 0 && p.peek() == stop {
      break
    }
    if p.peek() != ',' {
      return nil, p.errorf("expected ','")
    }
    p.offset++
    p.skipSpace()
    if p.eof() || stop != 0 && p.peek() == stop {
      return nil, p.errorf("expected selector after ','")
    }
  }
  if len(selectors) == 1 {
    return selectors[0], nil
  }
  return &astSelector{kind: astSelectorMatches, selectors: selectors}, nil
}

func (p *astSelectorParser) parseSelector() (*astSelector, error) {
  left, err := p.parseSequence()
  if err != nil {
    return nil, err
  }
  for {
    spaced := p.skipSpace()
    if p.eof() || p.peek() == ',' || p.peek() == ')' {
      return left, nil
    }
    kind := astSelectorDescendant
    switch p.peek() {
    case '>':
      kind = astSelectorChild
      p.offset++
      p.skipSpace()
    case '~':
      kind = astSelectorSibling
      p.offset++
      p.skipSpace()
    case '+':
      kind = astSelectorAdjacent
      p.offset++
      p.skipSpace()
    default:
      if !spaced {
        return left, nil
      }
    }
    right, err := p.parseSequence()
    if err != nil {
      return nil, err
    }
    left = &astSelector{kind: kind, left: left, right: right}
  }
}

func (p *astSelectorParser) parseSequence() (*astSelector, error) {
  subject := false
  if !p.eof() && p.peek() == '!' {
    subject = true
    p.offset++
  }
  atoms := make([]*astSelector, 0, 2)
  for !p.eof() {
    switch p.peek() {
    case ' ', '\t', '\r', '\n', ',', ')', '>', '~', '+':
      goto done
    }
    atom, err := p.parseAtom()
    if err != nil {
      return nil, err
    }
    atoms = append(atoms, atom)
  }

done:
  if len(atoms) == 0 {
    return nil, p.errorf("expected selector atom")
  }
  var result *astSelector
  if len(atoms) == 1 {
    result = atoms[0]
  } else {
    result = &astSelector{kind: astSelectorCompound, selectors: atoms}
  }
  result.subject = subject
  return result, nil
}

func (p *astSelectorParser) parseAtom() (*astSelector, error) {
  if p.eof() {
    return nil, p.errorf("expected selector atom")
  }
  switch p.peek() {
  case '*':
    p.offset++
    return &astSelector{kind: astSelectorWildcard}, nil
  case '[':
    return p.parseAttribute()
  case '.':
    return p.parseField()
  case ':':
    return p.parsePseudo()
  case '#':
    p.offset++
  }
  name := p.parseIdentifier()
  if name == "" {
    return nil, p.errorf("expected node type")
  }
  return &astSelector{kind: astSelectorNodeType, name: name}, nil
}

func (p *astSelectorParser) parseAttribute() (*astSelector, error) {
  p.offset++
  p.skipSpace()
  name := p.parsePath()
  if name == "" {
    return nil, p.errorf("expected attribute name")
  }
  p.skipSpace()
  if p.eof() {
    return nil, p.errorf("unterminated attribute selector")
  }
  if p.peek() == ']' {
    p.offset++
    return &astSelector{kind: astSelectorAttribute, name: name}, nil
  }
  operator := ""
  if strings.ContainsRune("!<>", rune(p.peek())) {
    operator = string(p.peek())
    p.offset++
  }
  if !p.eof() && p.peek() == '=' {
    operator += "="
    p.offset++
  } else if operator == "!" {
    return nil, p.errorf("expected '=' after '!'")
  }
  if operator == "" {
    return nil, p.errorf("expected attribute operator")
  }
  p.skipSpace()
  value, err := p.parseAttributeValue(operator)
  if err != nil {
    return nil, err
  }
  p.skipSpace()
  if p.eof() || p.peek() != ']' {
    return nil, p.errorf("expected ']'")
  }
  p.offset++
  return &astSelector{
    kind:     astSelectorAttribute,
    name:     name,
    operator: operator,
    value:    value,
  }, nil
}

func (p *astSelectorParser) parseAttributeValue(operator string) (astSelectorValue, error) {
  if p.eof() {
    return astSelectorValue{}, p.errorf("expected attribute value")
  }
  if p.peek() == '\'' || p.peek() == '"' {
    value, err := p.parseQuoted()
    return astSelectorValue{kind: astSelectorValueLiteral, literal: value}, err
  }
  if p.peek() == '/' {
    if operator != "=" && operator != "!=" {
      return astSelectorValue{}, p.errorf("regular expressions require '=' or '!='")
    }
    compiled, err := p.parseRegexp()
    return astSelectorValue{kind: astSelectorValueRegexp, regexp: compiled}, err
  }
  if strings.HasPrefix(p.source[p.offset:], "type(") {
    if operator != "=" && operator != "!=" {
      return astSelectorValue{}, p.errorf("type() requires '=' or '!='")
    }
    p.offset += len("type(")
    p.skipSpace()
    start := p.offset
    for !p.eof() && !isASTSelectorSpace(p.peek()) && p.peek() != ')' {
      p.offset++
    }
    name := p.source[start:p.offset]
    p.skipSpace()
    if name == "" || p.eof() || p.peek() != ')' {
      return astSelectorValue{}, p.errorf("invalid type() value")
    }
    p.offset++
    return astSelectorValue{kind: astSelectorValueType, literal: name}, nil
  }
  if p.peek() == '.' {
    start := p.offset
    p.offset++
    for !p.eof() && p.peek() >= '0' && p.peek() <= '9' {
      p.offset++
    }
    raw := p.source[start:p.offset]
    if !astSelectorNumberPattern.MatchString(raw) {
      return astSelectorValue{}, p.errorf("invalid attribute value")
    }
    number, _ := strconv.ParseFloat(raw, 64)
    return astSelectorValue{kind: astSelectorValueLiteral, literal: raw, number: &number}, nil
  }
  if p.peek() >= '0' && p.peek() <= '9' {
    start := p.offset
    for !p.eof() && p.peek() >= '0' && p.peek() <= '9' {
      p.offset++
    }
    if !p.eof() && p.peek() == '.' {
      p.offset++
      for !p.eof() && p.peek() >= '0' && p.peek() <= '9' {
        p.offset++
      }
      raw := p.source[start:p.offset]
      if !astSelectorNumberPattern.MatchString(raw) {
        return astSelectorValue{}, p.errorf("invalid attribute value")
      }
      number, _ := strconv.ParseFloat(raw, 64)
      return astSelectorValue{kind: astSelectorValueLiteral, literal: raw, number: &number}, nil
    }
    p.offset = start
  }
  raw := p.parseIdentifier()
  if raw == "" {
    return astSelectorValue{}, p.errorf("expected attribute value")
  }
  if astSelectorNumberPattern.MatchString(raw) {
    number, _ := strconv.ParseFloat(raw, 64)
    return astSelectorValue{kind: astSelectorValueLiteral, literal: raw, number: &number}, nil
  }
  return astSelectorValue{kind: astSelectorValueLiteral, literal: raw}, nil
}

func (p *astSelectorParser) parseQuoted() (string, error) {
  quote := p.peek()
  p.offset++
  var out strings.Builder
  for !p.eof() {
    ch := p.peek()
    p.offset++
    if ch == quote {
      return out.String(), nil
    }
    if ch != '\\' {
      out.WriteByte(ch)
      continue
    }
    if p.eof() {
      return "", p.errorf("unterminated string escape")
    }
    escaped := p.peek()
    p.offset++
    switch escaped {
    case 'b':
      out.WriteByte('\b')
    case 'f':
      out.WriteByte('\f')
    case 'n':
      out.WriteByte('\n')
    case 'r':
      out.WriteByte('\r')
    case 't':
      out.WriteByte('\t')
    case 'v':
      out.WriteByte('\v')
    default:
      out.WriteByte(escaped)
    }
  }
  return "", p.errorf("unterminated string")
}

func (p *astSelectorParser) parseRegexp() (*regexp.Regexp, error) {
  p.offset++
  start := p.offset
  inClass := false
  escaped := false
  end := -1
  for !p.eof() {
    ch := p.peek()
    p.offset++
    if escaped {
      escaped = false
      continue
    }
    if ch == '\\' {
      escaped = true
      continue
    }
    if ch == '[' {
      inClass = true
      continue
    }
    if ch == ']' {
      inClass = false
      continue
    }
    if ch == '/' && !inClass {
      end = p.offset - 1
      break
    }
  }
  if end < 0 {
    return nil, p.errorf("unterminated regular expression")
  }
  if end == start {
    return nil, p.errorf("regular expression must not be empty")
  }
  seenFlags := map[byte]struct{}{}
  var goFlags strings.Builder
  for !p.eof() {
    flag := p.peek()
    if !strings.ContainsRune("imsu", rune(flag)) {
      break
    }
    p.offset++
    if _, duplicate := seenFlags[flag]; duplicate {
      return nil, p.errorf("duplicate regular-expression flag %q", flag)
    }
    seenFlags[flag] = struct{}{}
    if flag != 'u' {
      goFlags.WriteByte(flag)
    }
  }
  pattern := p.source[start:end]
  if goFlags.Len() != 0 {
    pattern = "(?" + goFlags.String() + ":" + pattern + ")"
  }
  compiled, err := regexp.Compile(pattern)
  if err != nil {
    return nil, p.errorf("invalid regular expression: %v", err)
  }
  return compiled, nil
}

func (p *astSelectorParser) parseField() (*astSelector, error) {
  p.offset++
  name := p.parsePath()
  if name == "" {
    return nil, p.errorf("expected field name")
  }
  return &astSelector{kind: astSelectorField, name: name}, nil
}

func (p *astSelectorParser) parsePseudo() (*astSelector, error) {
  p.offset++
  name := p.parseIdentifier()
  if name == "" {
    return nil, p.errorf("expected pseudo-selector name")
  }
  switch name {
  case "first-child":
    return &astSelector{kind: astSelectorNthChild, index: 1}, nil
  case "last-child":
    return &astSelector{kind: astSelectorNthLastChild, index: 1}, nil
  case "nth-child", "nth-last-child":
    if p.eof() || p.peek() != '(' {
      return nil, p.errorf("expected '('")
    }
    p.offset++
    p.skipSpace()
    start := p.offset
    for !p.eof() && p.peek() >= '0' && p.peek() <= '9' {
      p.offset++
    }
    if start == p.offset {
      return nil, p.errorf("expected positive child index")
    }
    index, _ := strconv.Atoi(p.source[start:p.offset])
    p.skipSpace()
    if p.eof() || p.peek() != ')' {
      return nil, p.errorf("expected ')'")
    }
    p.offset++
    kind := astSelectorNthChild
    if name == "nth-last-child" {
      kind = astSelectorNthLastChild
    }
    return &astSelector{kind: kind, index: index}, nil
  case "not", "matches", "is", "has":
    if p.eof() || p.peek() != '(' {
      return nil, p.errorf("expected '('")
    }
    p.offset++
    p.skipSpace()
    var nested *astSelector
    var err error
    if name == "has" {
      nested, err = p.parseHasSelectorList()
    } else {
      nested, err = p.parseSelectorList(')')
    }
    if err != nil {
      return nil, err
    }
    p.skipSpace()
    if p.eof() || p.peek() != ')' {
      return nil, p.errorf("expected ')'")
    }
    p.offset++
    kind := astSelectorMatches
    switch name {
    case "not":
      kind = astSelectorNot
    case "has":
      kind = astSelectorHas
    }
    selectors := nested.selectors
    if nested.kind != astSelectorMatches {
      selectors = []*astSelector{nested}
    }
    return &astSelector{kind: kind, selectors: selectors}, nil
  default:
    switch strings.ToLower(name) {
    case "statement", "expression", "declaration", "function", "pattern":
      return &astSelector{kind: astSelectorClass, name: name}, nil
    default:
      return nil, p.errorf("unknown AST class %q", name)
    }
  }
}

func (p *astSelectorParser) parseHasSelectorList() (*astSelector, error) {
  selectors := make([]*astSelector, 0, 1)
  for {
    p.skipSpace()
    if p.eof() || p.peek() == ')' {
      if len(selectors) == 0 {
        return nil, p.errorf("expected selector")
      }
      break
    }
    var leading astSelectorKind
    switch p.peek() {
    case '>':
      leading = astSelectorChild
    case '~':
      leading = astSelectorSibling
    case '+':
      leading = astSelectorAdjacent
    }
    if leading != 0 {
      p.offset++
      p.skipSpace()
    }
    selector, err := p.parseSelector()
    if err != nil {
      return nil, err
    }
    if leading != 0 {
      selector = &astSelector{
        kind:  leading,
        left:  &astSelector{kind: astSelectorExactNode},
        right: selector,
      }
    }
    selectors = append(selectors, selector)
    p.skipSpace()
    if p.eof() || p.peek() == ')' {
      break
    }
    if p.peek() != ',' {
      return nil, p.errorf("expected ','")
    }
    p.offset++
  }
  if len(selectors) == 1 {
    return selectors[0], nil
  }
  return &astSelector{kind: astSelectorMatches, selectors: selectors}, nil
}

func (p *astSelectorParser) parsePath() string {
  first := p.parseIdentifier()
  if first == "" {
    return ""
  }
  var path strings.Builder
  path.WriteString(first)
  for !p.eof() && p.peek() == '.' {
    mark := p.offset
    p.offset++
    next := p.parseIdentifier()
    if next == "" {
      p.offset = mark
      break
    }
    path.WriteByte('.')
    path.WriteString(next)
  }
  return path.String()
}

func (p *astSelectorParser) parseIdentifier() string {
  start := p.offset
  for !p.eof() {
    ch := p.peek()
    if isASTSelectorSpace(ch) || strings.ContainsRune("[](),:#!=><~+.", rune(ch)) {
      break
    }
    p.offset++
  }
  return p.source[start:p.offset]
}

func (p *astSelectorParser) skipSpace() bool {
  start := p.offset
  for !p.eof() && isASTSelectorSpace(p.peek()) {
    p.offset++
  }
  return p.offset != start
}

func (p *astSelectorParser) eof() bool { return p.offset >= len(p.source) }
func (p *astSelectorParser) peek() byte { return p.source[p.offset] }

func (p *astSelectorParser) errorf(format string, args ...any) error {
  return fmt.Errorf("selector byte %d: %s", p.offset+1, fmt.Sprintf(format, args...))
}

func isASTSelectorSpace(ch byte) bool {
  return ch < unicode.MaxASCII && unicode.IsSpace(rune(ch))
}

var astSelectorNumberPattern = regexp.MustCompile(`^(?:[0-9]*\.)?[0-9]+$`)
