// regex_tree.go hosts the ECMAScript regular-expression AST used by
// unicorn/better-regex: node types, a source-faithful parser, a generator,
// and the structural-equality encoding the optimizer transforms rely on.
//
// The AST deliberately mirrors regexp-tree (the library the upstream ESLint
// rule delegated to) because the optimizer in regex_tree_optimizer.go is a
// behavioral port of regexp-tree's optimizer: node shapes, char "kinds", and
// even which optional fields a construction site sets all feed the
// duplicate-elimination checks, so they are modeled explicitly (see
// regexEqualityKey). Deviations from regexp-tree are deliberate safety fixes
// and are called out inline with "SAFETY:" comments; each one turns a fix
// that would corrupt regex semantics into a semantics-preserving one.
//
// The parser follows the ECMAScript RegExp grammar including the Annex B
// web-compat extensions the TypeScript scanner accepts (legacy octal
// escapes, identity escapes, literal `{` / `}` / `]`), so valid source
// regexes parse instead of raising false "Problem parsing" reports. Strict
// syntax violations regexp-tree also rejects (quantified assertions, bare
// quantifiers, out-of-order ranges) stay parse errors because the upstream
// rule reports those as parse-error diagnostics.
package linthost

import (
  "fmt"
  "sort"
  "strconv"
  "strings"
  "unicode/utf16"
)

// regexNode is the closed union of regex AST node types.
type regexNode interface {
  isRegexNode()
}

// Tri-state presence markers for optional Char fields. regexp-tree encodes
// nodes to JSON for equality checks; a field that is absent, `null`/`NaN`,
// or a value produces three distinct encodings, and different construction
// sites (parser vs. individual transforms) set different field subsets, so
// presence must be modeled to reproduce which duplicates collapse.
const (
  regexFieldAbsent uint8 = iota
  regexFieldNaN
  regexFieldValue
)

// regexRegExpNode is the root: `/Body/Flags`. Body is nil for an empty
// pattern.
type regexRegExpNode struct {
  Body  regexNode
  Flags string
}

// regexCharNode is a single character or character escape.
//
// Kind mirrors regexp-tree: "simple" (a, \e), "meta" (., \d, \n, [\b]),
// "hex" (\x41), "unicode" (A, \u{1f680}), "oct" (\052), "decimal"
// (\0), "control" (\cA and, as a SAFETY deviation, the dangling `\c`).
type regexCharNode struct {
  Value          string
  Kind           string
  Symbol         string
  SymbolState    uint8
  CodePoint      int
  CodePointState uint8
  Escaped        bool
  EscapedState   uint8
  SurrogatePair  bool // JSON key present (always true when present)
  // AltKeyOrder marks Chars built by the char-code-to-simple-char
  // transform, whose JSON key order (kind before value) differs from
  // parser-built Chars. regexp-tree's equality is a JSON string compare,
  // so those nodes never equal parser-built ones; see regexEqualityKey.
  AltKeyOrder bool
}

// regexClassNode is `[...]` / `[^...]`.
type regexClassNode struct {
  Negative    bool
  Expressions []regexNode
  // Loc is the half-open rune span of the class in the parsed pattern
  // body. Only the constructor-path surgical rewrite reads it; transforms
  // and equality ignore it (regexp-tree equality also skips loc).
  LocStart int
  LocEnd   int
}

// regexClassRangeNode is `a-z` inside a character class.
type regexClassRangeNode struct {
  From *regexCharNode
  To   *regexCharNode
}

// regexAlternativeNode is a concatenation of two or more terms.
type regexAlternativeNode struct {
  Expressions []regexNode
}

// regexDisjunctionNode is `left|right`; either side may be nil (empty
// alternative). Chains nest through Left, matching regexp-tree.
type regexDisjunctionNode struct {
  Left  regexNode
  Right regexNode
}

// regexGroupNode is `(...)`, `(?:...)`, or `(?<name>...)`. Expression is
// nil for an empty group. HasNumber distinguishes parser-built capturing
// groups (number always present) from transform-built non-capturing groups
// (no number key), which matters for equality.
type regexGroupNode struct {
  Capturing  bool
  Name       string
  NameRaw    string
  Number     int
  HasNumber  bool
  Expression regexNode
}

// regexBackreferenceNode is `\1` or `\k<name>`.
type regexBackreferenceNode struct {
  Kind         string // "number" | "name"
  Number       int
  Reference    string // name form only
  ReferenceRaw string
}

// regexRepetitionNode is an atom with a quantifier.
type regexRepetitionNode struct {
  Expression regexNode
  Quantifier *regexQuantifierNode
}

// regexQuantifierNode is `*`, `+`, `?`, or `{n}`/`{n,}`/`{n,m}` (kind
// "Range"). HasTo is false for open ranges. FieldOrder records the
// JavaScript object-key order of the from/to/greedy fields ("f", "t", "g"
// letters): regexp-tree mutates quantifiers in place, and a field assigned
// after deletion re-appends to the key order, which its JSON-based equality
// observes. Parser-built symbol quantifiers use "g", open ranges "fg",
// closed ranges "ftg".
type regexQuantifierNode struct {
  Kind       string
  From       int
  To         int
  HasTo      bool
  Greedy     bool
  FieldOrder string
}

// regexAssertionNode is `^`, `$`, `\b`, `\B`, or a lookaround. Negative is
// tri-state via HasNegative: parser sets the key only on negative
// lookarounds, mirroring regexp-tree's JSON.
type regexAssertionNode struct {
  Kind        string // "^" | "$" | "\\b" | "\\B" | "Lookahead" | "Lookbehind"
  Negative    bool
  HasNegative bool
  Assertion   regexNode
}

// regexUnicodePropertyNode is `\p{...}` / `\P{...}` (u/v mode only).
type regexUnicodePropertyNode struct {
  Name      string
  Value     string
  Negative  bool
  Shorthand bool
  Binary    bool
}

// regexClassSetNode is an opaque `v`-mode class that uses set notation
// (nested classes, `--`/`&&` operators, or `\q{...}` strings). The rule
// never rewrites these; the node exists so a unicode-sets pattern parses
// instead of being misread, and regenerates verbatim.
type regexClassSetNode struct {
  Raw      string
  LocStart int
  LocEnd   int
}

func (*regexRegExpNode) isRegexNode()          {}
func (*regexCharNode) isRegexNode()            {}
func (*regexClassNode) isRegexNode()           {}
func (*regexClassRangeNode) isRegexNode()      {}
func (*regexAlternativeNode) isRegexNode()     {}
func (*regexDisjunctionNode) isRegexNode()     {}
func (*regexGroupNode) isRegexNode()           {}
func (*regexBackreferenceNode) isRegexNode()   {}
func (*regexRepetitionNode) isRegexNode()      {}
func (*regexQuantifierNode) isRegexNode()      {}
func (*regexAssertionNode) isRegexNode()       {}
func (*regexUnicodePropertyNode) isRegexNode() {}
func (*regexClassSetNode) isRegexNode()        {}

// codePointIsNaN mirrors JavaScript's isNaN(node.codePoint): true when the
// field is absent (undefined) or NaN.
func (c *regexCharNode) codePointIsNaN() bool {
  return c.CodePointState != regexFieldValue
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

// regexGenerate renders a full `/body/flags` literal string from the AST.
func regexGenerate(re *regexRegExpNode) string {
  var sb strings.Builder
  sb.WriteByte('/')
  regexGenerateNode(&sb, re.Body)
  sb.WriteByte('/')
  sb.WriteString(re.Flags)
  return sb.String()
}

// regexGeneratePattern renders only the pattern body.
func regexGeneratePattern(node regexNode) string {
  var sb strings.Builder
  regexGenerateNode(&sb, node)
  return sb.String()
}

func regexGenerateNode(sb *strings.Builder, node regexNode) {
  switch n := node.(type) {
  case nil:
  case *regexAlternativeNode:
    for _, e := range n.Expressions {
      regexGenerateNode(sb, e)
    }
  case *regexDisjunctionNode:
    regexGenerateNode(sb, n.Left)
    sb.WriteByte('|')
    regexGenerateNode(sb, n.Right)
  case *regexGroupNode:
    if n.Capturing {
      if n.Name != "" {
        sb.WriteString("(?<")
        if n.NameRaw != "" {
          sb.WriteString(n.NameRaw)
        } else {
          sb.WriteString(n.Name)
        }
        sb.WriteByte('>')
        regexGenerateNode(sb, n.Expression)
        sb.WriteByte(')')
      } else {
        sb.WriteByte('(')
        regexGenerateNode(sb, n.Expression)
        sb.WriteByte(')')
      }
    } else {
      sb.WriteString("(?:")
      regexGenerateNode(sb, n.Expression)
      sb.WriteByte(')')
    }
  case *regexBackreferenceNode:
    if n.Kind == "number" {
      sb.WriteByte('\\')
      sb.WriteString(strconv.Itoa(n.Number))
    } else {
      sb.WriteString("\\k<")
      if n.ReferenceRaw != "" {
        sb.WriteString(n.ReferenceRaw)
      } else {
        sb.WriteString(n.Reference)
      }
      sb.WriteByte('>')
    }
  case *regexAssertionNode:
    switch n.Kind {
    case "^", "$", "\\b", "\\B":
      sb.WriteString(n.Kind)
    case "Lookahead":
      if n.Negative {
        sb.WriteString("(?!")
      } else {
        sb.WriteString("(?=")
      }
      regexGenerateNode(sb, n.Assertion)
      sb.WriteByte(')')
    case "Lookbehind":
      if n.Negative {
        sb.WriteString("(?<!")
      } else {
        sb.WriteString("(?<=")
      }
      regexGenerateNode(sb, n.Assertion)
      sb.WriteByte(')')
    }
  case *regexClassNode:
    if n.Negative {
      sb.WriteString("[^")
    } else {
      sb.WriteByte('[')
    }
    for i, e := range n.Expressions {
      // SAFETY: regexp-tree prints an unescaped literal `^` even when
      // class sorting moved it to the front, silently negating the
      // class ([a\^] -> [^a]). Re-escape it in that one position.
      if i == 0 && !n.Negative {
        if ch, ok := e.(*regexCharNode); ok && ch.Kind == "simple" &&
          ch.Value == "^" && !(ch.EscapedState == regexFieldValue && ch.Escaped) {
          sb.WriteString("\\^")
          continue
        }
      }
      regexGenerateNode(sb, e)
    }
    sb.WriteByte(']')
  case *regexClassRangeNode:
    regexGenerateChar(sb, n.From)
    sb.WriteByte('-')
    regexGenerateChar(sb, n.To)
  case *regexRepetitionNode:
    regexGenerateNode(sb, n.Expression)
    regexGenerateNode(sb, n.Quantifier)
  case *regexQuantifierNode:
    switch n.Kind {
    case "+", "?", "*":
      sb.WriteString(n.Kind)
    case "Range":
      if n.HasTo && n.From == n.To {
        fmt.Fprintf(sb, "{%d}", n.From)
      } else if !n.HasTo {
        fmt.Fprintf(sb, "{%d,}", n.From)
      } else {
        fmt.Fprintf(sb, "{%d,%d}", n.From, n.To)
      }
    }
    if !n.Greedy {
      sb.WriteByte('?')
    }
  case *regexCharNode:
    regexGenerateChar(sb, n)
  case *regexUnicodePropertyNode:
    if n.Negative {
      sb.WriteString("\\P{")
    } else {
      sb.WriteString("\\p{")
    }
    if !n.Shorthand && !n.Binary {
      sb.WriteString(n.Name)
      sb.WriteByte('=')
    }
    sb.WriteString(n.Value)
    sb.WriteByte('}')
  case *regexClassSetNode:
    sb.WriteString(n.Raw)
  }
}

func regexGenerateChar(sb *strings.Builder, n *regexCharNode) {
  if n == nil {
    return
  }
  if n.Kind == "simple" {
    if n.EscapedState == regexFieldValue && n.Escaped {
      sb.WriteByte('\\')
    }
    sb.WriteString(n.Value)
    return
  }
  // hex, unicode, oct, decimal, control, meta: the value carries its own
  // spelling (including the backslash).
  sb.WriteString(n.Value)
}

// ---------------------------------------------------------------------------
// Equality
// ---------------------------------------------------------------------------

// regexEqualityKey renders a canonical encoding of a node that separates
// exactly the same node pairs regexp-tree's JSON.stringify-based equality
// separates: field presence, NaN-vs-absent, and construction-site key order
// all participate. It is only ever compared against other keys produced by
// this function.
func regexEqualityKey(node regexNode) string {
  var sb strings.Builder
  regexEqualityKeyRec(&sb, node)
  return sb.String()
}

func regexEqualityKeyRec(sb *strings.Builder, node regexNode) {
  switch n := node.(type) {
  case nil:
    sb.WriteString("null")
  case *regexCharNode:
    sb.WriteString("Char{")
    if n.AltKeyOrder {
      fmt.Fprintf(sb, "kind:%s,value:%q,", n.Kind, n.Value)
    } else {
      fmt.Fprintf(sb, "value:%q,kind:%s,", n.Value, n.Kind)
    }
    switch n.SymbolState {
    case regexFieldValue:
      fmt.Fprintf(sb, "symbol:%q,", n.Symbol)
    }
    switch n.CodePointState {
    case regexFieldNaN:
      sb.WriteString("codePoint:null,")
    case regexFieldValue:
      fmt.Fprintf(sb, "codePoint:%d,", n.CodePoint)
    }
    if n.EscapedState == regexFieldValue {
      fmt.Fprintf(sb, "escaped:%t,", n.Escaped)
    }
    if n.SurrogatePair {
      sb.WriteString("isSurrogatePair:true,")
    }
    sb.WriteByte('}')
  case *regexClassNode:
    fmt.Fprintf(sb, "CharacterClass{negative:%t,[", n.Negative)
    for _, e := range n.Expressions {
      regexEqualityKeyRec(sb, e)
      sb.WriteByte(',')
    }
    sb.WriteString("]}")
  case *regexClassRangeNode:
    sb.WriteString("ClassRange{")
    regexEqualityKeyRec(sb, n.From)
    sb.WriteByte(',')
    regexEqualityKeyRec(sb, n.To)
    sb.WriteByte('}')
  case *regexAlternativeNode:
    sb.WriteString("Alternative[")
    for _, e := range n.Expressions {
      regexEqualityKeyRec(sb, e)
      sb.WriteByte(',')
    }
    sb.WriteByte(']')
  case *regexDisjunctionNode:
    sb.WriteString("Disjunction{")
    regexEqualityKeyRec(sb, n.Left)
    sb.WriteByte(',')
    regexEqualityKeyRec(sb, n.Right)
    sb.WriteByte('}')
  case *regexGroupNode:
    fmt.Fprintf(sb, "Group{capturing:%t,", n.Capturing)
    if n.Name != "" {
      fmt.Fprintf(sb, "name:%q,nameRaw:%q,", n.Name, n.NameRaw)
    }
    if n.HasNumber {
      fmt.Fprintf(sb, "number:%d,", n.Number)
    }
    regexEqualityKeyRec(sb, n.Expression)
    sb.WriteByte('}')
  case *regexBackreferenceNode:
    if n.Kind == "number" {
      fmt.Fprintf(sb, "Backreference{number,%d}", n.Number)
    } else {
      fmt.Fprintf(sb, "Backreference{name,%d,%q,%q}", n.Number, n.Reference, n.ReferenceRaw)
    }
  case *regexRepetitionNode:
    sb.WriteString("Repetition{")
    regexEqualityKeyRec(sb, n.Expression)
    sb.WriteByte(',')
    regexEqualityKeyRec(sb, n.Quantifier)
    sb.WriteByte('}')
  case *regexQuantifierNode:
    fmt.Fprintf(sb, "Quantifier{kind:%s,", n.Kind)
    for _, field := range n.FieldOrder {
      switch field {
      case 'f':
        fmt.Fprintf(sb, "from:%d,", n.From)
      case 't':
        fmt.Fprintf(sb, "to:%d,", n.To)
      case 'g':
        fmt.Fprintf(sb, "greedy:%t,", n.Greedy)
      }
    }
    sb.WriteByte('}')
  case *regexAssertionNode:
    fmt.Fprintf(sb, "Assertion{kind:%s,", n.Kind)
    if n.HasNegative {
      fmt.Fprintf(sb, "negative:%t,", n.Negative)
    }
    regexEqualityKeyRec(sb, n.Assertion)
    sb.WriteByte('}')
  case *regexUnicodePropertyNode:
    fmt.Fprintf(sb, "UnicodeProperty{%q,%q,%t,%t,%t}", n.Name, n.Value, n.Negative, n.Shorthand, n.Binary)
  case *regexClassSetNode:
    fmt.Fprintf(sb, "ClassSet{%q}", n.Raw)
  }
}

// ---------------------------------------------------------------------------
// Clone
// ---------------------------------------------------------------------------

// regexCloneRegExp deep-copies the tree, mirroring regexp-tree's clone()
// (which preserves NaN and field presence).
func regexCloneRegExp(re *regexRegExpNode) *regexRegExpNode {
  return &regexRegExpNode{Body: regexCloneNode(re.Body), Flags: re.Flags}
}

func regexCloneNode(node regexNode) regexNode {
  switch n := node.(type) {
  case nil:
    return nil
  case *regexCharNode:
    c := *n
    return &c
  case *regexClassNode:
    c := *n
    c.Expressions = cloneRegexList(n.Expressions)
    return &c
  case *regexClassRangeNode:
    return &regexClassRangeNode{
      From: regexCloneNode(n.From).(*regexCharNode),
      To:   regexCloneNode(n.To).(*regexCharNode),
    }
  case *regexAlternativeNode:
    return &regexAlternativeNode{Expressions: cloneRegexList(n.Expressions)}
  case *regexDisjunctionNode:
    return &regexDisjunctionNode{Left: regexCloneNode(n.Left), Right: regexCloneNode(n.Right)}
  case *regexGroupNode:
    c := *n
    c.Expression = regexCloneNode(n.Expression)
    return &c
  case *regexBackreferenceNode:
    c := *n
    return &c
  case *regexRepetitionNode:
    q := *n.Quantifier
    return &regexRepetitionNode{Expression: regexCloneNode(n.Expression), Quantifier: &q}
  case *regexQuantifierNode:
    c := *n
    return &c
  case *regexAssertionNode:
    c := *n
    c.Assertion = regexCloneNode(n.Assertion)
    return &c
  case *regexUnicodePropertyNode:
    c := *n
    return &c
  case *regexClassSetNode:
    c := *n
    return &c
  }
  return nil
}

func cloneRegexList(list []regexNode) []regexNode {
  out := make([]regexNode, len(list))
  for i, e := range list {
    out[i] = regexCloneNode(e)
  }
  return out
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

// regexParseError is a positioned syntax error inside a pattern.
type regexParseError struct {
  Message string
}

func (e *regexParseError) Error() string { return e.Message }

type regexParser struct {
  src   []rune
  pos   int
  flags string
  // grammar mode
  uMode bool
  vMode bool
  // prescan results
  groupCount int
  groupNames map[string]bool
  // running capture-group numbering
  nextGroupNumber int
}

// regexParseLiteral parses a full `/pattern/flags` literal string.
func regexParseLiteral(literal string) (*regexRegExpNode, error) {
  runes := []rune(literal)
  if len(runes) < 2 || runes[0] != '/' {
    return nil, &regexParseError{Message: "not a regular expression literal"}
  }
  // Find the closing, unescaped `/` outside a character class.
  body := -1
  inClass := false
  for i := 1; i < len(runes); i++ {
    switch runes[i] {
    case '\\':
      i++
    case '[':
      inClass = true
    case ']':
      inClass = false
    case '/':
      if !inClass {
        body = i
      }
    }
    if body >= 0 {
      break
    }
  }
  if body < 0 {
    return nil, &regexParseError{Message: "unterminated regular expression literal"}
  }
  pattern := string(runes[1:body])
  flags := string(runes[body+1:])
  return regexParsePattern(pattern, flags, true)
}

// regexParsePattern parses a pattern body with the given flags.
// validateFlags additionally rejects malformed flag strings (used for the
// literal path; the constructor path reads flags leniently the way the
// upstream rule's clean-regexp step did).
func regexParsePattern(pattern string, flags string, validateFlags bool) (*regexRegExpNode, error) {
  normalizedFlags := flags
  if validateFlags {
    sorted, err := regexNormalizeFlags(flags)
    if err != nil {
      return nil, err
    }
    normalizedFlags = sorted
  } else {
    runes := []rune(flags)
    sort.Slice(runes, func(i, j int) bool { return runes[i] < runes[j] })
    normalizedFlags = string(runes)
  }
  p := &regexParser{
    src:             []rune(pattern),
    flags:           normalizedFlags,
    uMode:           strings.ContainsRune(flags, 'u'),
    vMode:           strings.ContainsRune(flags, 'v'),
    groupNames:      map[string]bool{},
    nextGroupNumber: 1,
  }
  if err := p.prescanGroups(); err != nil {
    return nil, err
  }
  body, err := p.parseDisjunction(true)
  if err != nil {
    return nil, err
  }
  if p.pos < len(p.src) {
    return nil, p.errorAt(p.pos, fmt.Sprintf("unexpected token %q", string(p.src[p.pos])))
  }
  return &regexRegExpNode{Body: body, Flags: normalizedFlags}, nil
}

// regexNormalizeFlags validates and alphabetically sorts a flag string, the
// way regexp-tree's parser normalizes flags before generation.
func regexNormalizeFlags(flags string) (string, error) {
  seen := map[rune]bool{}
  runes := []rune(flags)
  for _, r := range runes {
    if !strings.ContainsRune("dgimsuvy", r) {
      return "", &regexParseError{Message: fmt.Sprintf("invalid regular expression flag %q", string(r))}
    }
    if seen[r] {
      return "", &regexParseError{Message: fmt.Sprintf("duplicate regular expression flag %q", string(r))}
    }
    seen[r] = true
  }
  if seen['u'] && seen['v'] {
    return "", &regexParseError{Message: "regular expression flags \"u\" and \"v\" cannot be combined"}
  }
  sort.Slice(runes, func(i, j int) bool { return runes[i] < runes[j] })
  return string(runes), nil
}

func (p *regexParser) errorAt(pos int, message string) error {
  return &regexParseError{Message: fmt.Sprintf("%s at index %d", message, pos)}
}

func (p *regexParser) errorEOF() error {
  return &regexParseError{Message: "unexpected end of input"}
}

// prescanGroups counts capturing groups and collects named-group names so
// that `\1` and `\k<name>` resolve against the whole pattern (forward
// references included), matching ECMAScript's two-phase resolution.
func (p *regexParser) prescanGroups() error {
  src := p.src
  for i := 0; i < len(src); i++ {
    switch src[i] {
    case '\\':
      i++
    case '[':
      // Skip class contents; `\]` does not close, and v-mode classes
      // nest.
      depth := 1
      for i++; i < len(src) && depth > 0; i++ {
        if src[i] == '\\' {
          i++
        } else if p.vMode && src[i] == '[' {
          depth++
        } else if src[i] == ']' {
          depth--
        }
      }
      i--
    case '(':
      if i+1 < len(src) && src[i+1] == '?' {
        if i+2 < len(src) && src[i+2] == '<' &&
          i+3 < len(src) && src[i+3] != '=' && src[i+3] != '!' {
          // Named capturing group.
          end := i + 3
          for end < len(src) && src[end] != '>' {
            end++
          }
          if end >= len(src) {
            return p.errorEOF()
          }
          name, _, err := p.decodeGroupName(src[i+3 : end])
          if err != nil {
            return err
          }
          if p.groupNames[name] {
            return &regexParseError{Message: fmt.Sprintf("duplicate capture group name %q", name)}
          }
          p.groupNames[name] = true
          p.groupCount++
          i = end
        }
        // (?: (?= (?! (?<= (?<! are non-capturing.
      } else {
        p.groupCount++
      }
    }
  }
  return nil
}

// decodeGroupName validates a group-name rune slice and decodes \uXXXX /
// \u{...} escapes. Returns the decoded name and the raw spelling.
func (p *regexParser) decodeGroupName(raw []rune) (string, string, error) {
  if len(raw) == 0 {
    return "", "", &regexParseError{Message: "empty capture group name"}
  }
  var name strings.Builder
  first := true
  for i := 0; i < len(raw); i++ {
    r := raw[i]
    if r == '\\' {
      if i+1 >= len(raw) || raw[i+1] != 'u' {
        return "", "", &regexParseError{Message: "invalid capture group name"}
      }
      decoded, consumed, ok := decodeUnicodeEscapeBody(raw[i+2:], true)
      if !ok {
        return "", "", &regexParseError{Message: "invalid capture group name"}
      }
      r = decoded
      i += 1 + consumed
    }
    if !isRegexIdentifierRune(r, first) {
      return "", "", &regexParseError{Message: fmt.Sprintf("invalid capture group name character %q", string(r))}
    }
    name.WriteRune(r)
    first = false
  }
  return name.String(), string(raw), nil
}

func isRegexIdentifierRune(r rune, first bool) bool {
  if r == '$' || r == '_' {
    return true
  }
  if r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' {
    return true
  }
  if !first && r >= '0' && r <= '9' {
    return true
  }
  // Permit non-ASCII identifier characters leniently; the TypeScript
  // scanner has already validated the source literal.
  return r > 0x7f
}

// decodeUnicodeEscapeBody decodes the body after `\u`: either XXXX or
// {X...} (brace form only when braces are allowed). Returns the rune, the
// number of runes consumed after `\u`, and success.
func decodeUnicodeEscapeBody(src []rune, allowBraces bool) (rune, int, bool) {
  if len(src) >= 1 && src[0] == '{' && allowBraces {
    end := 1
    for end < len(src) && src[end] != '}' {
      end++
    }
    if end >= len(src) || end == 1 {
      return 0, 0, false
    }
    v, err := strconv.ParseInt(string(src[1:end]), 16, 64)
    if err != nil || v > 0x10ffff {
      return 0, 0, false
    }
    return rune(v), end + 1, true
  }
  if len(src) < 4 {
    return 0, 0, false
  }
  v, err := strconv.ParseInt(string(src[:4]), 16, 32)
  if err != nil {
    return 0, 0, false
  }
  return rune(v), 4, true
}

// parseDisjunction parses `alt (| alt)*`. When top is true the disjunction
// ends at end-of-input, otherwise at `)`.
func (p *regexParser) parseDisjunction(top bool) (regexNode, error) {
  first, err := p.parseAlternative(top)
  if err != nil {
    return nil, err
  }
  node := first
  for p.pos < len(p.src) && p.src[p.pos] == '|' {
    p.pos++
    next, err := p.parseAlternative(top)
    if err != nil {
      return nil, err
    }
    node = &regexDisjunctionNode{Left: node, Right: next}
  }
  return node, nil
}

// parseAlternative parses a run of terms up to `|`, `)`, or end.
func (p *regexParser) parseAlternative(top bool) (regexNode, error) {
  var terms []regexNode
  for p.pos < len(p.src) {
    r := p.src[p.pos]
    if r == '|' {
      break
    }
    if r == ')' {
      if top {
        return nil, p.errorAt(p.pos, "unexpected token \")\"")
      }
      break
    }
    term, err := p.parseTerm()
    if err != nil {
      return nil, err
    }
    terms = append(terms, term)
  }
  switch len(terms) {
  case 0:
    return nil, nil
  case 1:
    return terms[0], nil
  }
  return &regexAlternativeNode{Expressions: terms}, nil
}

// parseTerm parses one assertion or one atom plus an optional quantifier.
func (p *regexParser) parseTerm() (regexNode, error) {
  atom, quantifiable, err := p.parseAtom()
  if err != nil {
    return nil, err
  }
  quantifier, err := p.parseQuantifier()
  if err != nil {
    return nil, err
  }
  if quantifier == nil {
    return atom, nil
  }
  if !quantifiable {
    // Strict-grammar rejection of quantified assertions, matching
    // regexp-tree (`/(?!a)+/` is a parse error there too).
    return nil, p.errorAt(p.pos-1, fmt.Sprintf("unexpected quantifier after %q", regexGeneratePattern(atom)))
  }
  return &regexRepetitionNode{Expression: atom, Quantifier: quantifier}, nil
}

// parseQuantifier parses `*`, `+`, `?`, or a `{...}` range quantifier
// (returning nil when the `{` run is not quantifier-shaped, per Annex B).
func (p *regexParser) parseQuantifier() (*regexQuantifierNode, error) {
  if p.pos >= len(p.src) {
    return nil, nil
  }
  var q *regexQuantifierNode
  switch p.src[p.pos] {
  case '*', '+', '?':
    q = &regexQuantifierNode{Kind: string(p.src[p.pos]), Greedy: true, FieldOrder: "g"}
    p.pos++
  case '{':
    from, to, hasTo, exact, length := scanRangeQuantifier(p.src[p.pos:])
    if length == 0 {
      return nil, nil
    }
    if hasTo && !exact && to < from {
      return nil, p.errorAt(p.pos, "quantifier range out of order")
    }
    q = &regexQuantifierNode{Kind: "Range", From: from, Greedy: true, FieldOrder: "fg"}
    if exact {
      q.To = from
      q.HasTo = true
      q.FieldOrder = "ftg"
    } else if hasTo {
      q.To = to
      q.HasTo = true
      q.FieldOrder = "ftg"
    }
    p.pos += length
  default:
    return nil, nil
  }
  if p.pos < len(p.src) && p.src[p.pos] == '?' {
    q.Greedy = false
    p.pos++
  }
  return q, nil
}

// scanRangeQuantifier recognizes `{n}`, `{n,}`, `{n,m}` at the start of
// src. Returns (from, to, hasTo, exact, consumedRunes); consumedRunes is 0
// when the text is not a range quantifier.
func scanRangeQuantifier(src []rune) (int, int, bool, bool, int) {
  i := 1
  start := i
  for i < len(src) && src[i] >= '0' && src[i] <= '9' {
    i++
  }
  if i == start {
    return 0, 0, false, false, 0
  }
  from, err := strconv.Atoi(string(src[start:i]))
  if err != nil {
    return 0, 0, false, false, 0
  }
  if i < len(src) && src[i] == '}' {
    return from, 0, false, true, i + 1
  }
  if i >= len(src) || src[i] != ',' {
    return 0, 0, false, false, 0
  }
  i++
  if i < len(src) && src[i] == '}' {
    return from, 0, false, false, i + 1
  }
  start = i
  for i < len(src) && src[i] >= '0' && src[i] <= '9' {
    i++
  }
  if i == start || i >= len(src) || src[i] != '}' {
    return 0, 0, false, false, 0
  }
  to, err := strconv.Atoi(string(src[start:i]))
  if err != nil {
    return 0, 0, false, false, 0
  }
  return from, to, true, false, i + 1
}

// parseAtom parses one atom. The second result reports whether the atom is
// quantifiable (assertions are not).
func (p *regexParser) parseAtom() (regexNode, bool, error) {
  r := p.src[p.pos]
  switch r {
  case '^', '$':
    p.pos++
    return &regexAssertionNode{Kind: string(r)}, false, nil
  case '.':
    p.pos++
    return &regexCharNode{
      Value: ".", Kind: "meta",
      Symbol: ".", SymbolState: regexFieldValue,
      CodePointState: regexFieldNaN,
    }, true, nil
  case '\\':
    return p.parseEscape(false)
  case '[':
    node, err := p.parseCharacterClass()
    return node, true, err
  case '(':
    return p.parseGroup()
  case '*', '+', '?':
    return nil, false, p.errorAt(p.pos, fmt.Sprintf("unexpected token %q", string(r)))
  case '{':
    if _, _, _, _, length := scanRangeQuantifier(p.src[p.pos:]); length > 0 {
      return nil, false, p.errorAt(p.pos, fmt.Sprintf("unexpected token %q", string(p.src[p.pos:p.pos+length])))
    }
    p.pos++
    return simpleChar(r), true, nil
  default:
    // `]` and `}` are literal pattern characters per Annex B.
    p.pos++
    return regexPatternChar(r), true, nil
  }
}

// regexPatternChar builds a plain unescaped Char for a literal rune.
func regexPatternChar(r rune) *regexCharNode {
  return simpleChar(r)
}

func simpleChar(r rune) *regexCharNode {
  return &regexCharNode{
    Value: string(r), Kind: "simple",
    Symbol: string(r), SymbolState: regexFieldValue,
    CodePoint: int(r), CodePointState: regexFieldValue,
  }
}

func escapedSimpleChar(r rune) *regexCharNode {
  c := simpleChar(r)
  c.Escaped = true
  c.EscapedState = regexFieldValue
  return c
}

// parseGroup parses `(...)`, `(?:...)`, `(?<name>...)`, and lookarounds.
// Returns (node, quantifiable, err).
func (p *regexParser) parseGroup() (regexNode, bool, error) {
  start := p.pos
  p.pos++ // consume '('
  if p.pos < len(p.src) && p.src[p.pos] == '?' {
    p.pos++
    if p.pos >= len(p.src) {
      return nil, false, p.errorEOF()
    }
    switch p.src[p.pos] {
    case ':':
      p.pos++
      expr, err := p.parseGroupBody()
      if err != nil {
        return nil, false, err
      }
      return &regexGroupNode{Capturing: false, Expression: expr}, true, nil
    case '=', '!':
      negative := p.src[p.pos] == '!'
      p.pos++
      expr, err := p.parseGroupBody()
      if err != nil {
        return nil, false, err
      }
      node := &regexAssertionNode{Kind: "Lookahead", Assertion: expr}
      if negative {
        node.Negative = true
        node.HasNegative = true
      }
      return node, false, nil
    case '<':
      if p.pos+1 < len(p.src) && (p.src[p.pos+1] == '=' || p.src[p.pos+1] == '!') {
        negative := p.src[p.pos+1] == '!'
        p.pos += 2
        expr, err := p.parseGroupBody()
        if err != nil {
          return nil, false, err
        }
        node := &regexAssertionNode{Kind: "Lookbehind", Assertion: expr}
        if negative {
          node.Negative = true
          node.HasNegative = true
        }
        return node, false, nil
      }
      // Named capturing group.
      p.pos++
      nameStart := p.pos
      for p.pos < len(p.src) && p.src[p.pos] != '>' {
        p.pos++
      }
      if p.pos >= len(p.src) {
        return nil, false, p.errorEOF()
      }
      name, raw, err := p.decodeGroupName(p.src[nameStart:p.pos])
      if err != nil {
        return nil, false, err
      }
      p.pos++ // consume '>'
      number := p.nextGroupNumber
      p.nextGroupNumber++
      expr, err := p.parseGroupBody()
      if err != nil {
        return nil, false, err
      }
      return &regexGroupNode{
        Capturing: true, Name: name, NameRaw: raw,
        Number: number, HasNumber: true, Expression: expr,
      }, true, nil
    default:
      return nil, false, p.errorAt(start+1, "unexpected token \"?\"")
    }
  }
  number := p.nextGroupNumber
  p.nextGroupNumber++
  expr, err := p.parseGroupBody()
  if err != nil {
    return nil, false, err
  }
  return &regexGroupNode{Capturing: true, Number: number, HasNumber: true, Expression: expr}, true, nil
}

func (p *regexParser) parseGroupBody() (regexNode, error) {
  expr, err := p.parseDisjunction(false)
  if err != nil {
    return nil, err
  }
  if p.pos >= len(p.src) || p.src[p.pos] != ')' {
    return nil, p.errorEOF()
  }
  p.pos++
  return expr, nil
}

// parseEscape parses one `\`-escape. inClass selects the ClassEscape
// grammar. Returns (node, quantifiable, err).
func (p *regexParser) parseEscape(inClass bool) (regexNode, bool, error) {
  p.pos++ // consume '\'
  if p.pos >= len(p.src) {
    return nil, false, p.errorEOF()
  }
  r := p.src[p.pos]
  switch r {
  case 'd', 'D', 's', 'S', 'w', 'W':
    p.pos++
    return &regexCharNode{
      Value: "\\" + string(r), Kind: "meta",
      CodePointState: regexFieldNaN,
    }, true, nil
  case 'n', 'r', 't', 'v', 'f':
    p.pos++
    var symbol rune
    switch r {
    case 'n':
      symbol = '\n'
    case 'r':
      symbol = '\r'
    case 't':
      symbol = '\t'
    case 'v':
      symbol = '\v'
    case 'f':
      symbol = '\f'
    }
    return &regexCharNode{
      Value: "\\" + string(r), Kind: "meta",
      Symbol: string(symbol), SymbolState: regexFieldValue,
      CodePoint: int(symbol), CodePointState: regexFieldValue,
    }, true, nil
  case 'b':
    p.pos++
    if inClass {
      // [\b] is backspace. regexp-tree models it as a meta Char with a
      // placeholder symbol and NaN code point, which keeps every
      // transform away from it; mirror that.
      return &regexCharNode{
        Value: "\\b", Kind: "meta",
        Symbol: ".", SymbolState: regexFieldValue,
        CodePointState: regexFieldNaN,
      }, true, nil
    }
    return &regexAssertionNode{Kind: "\\b"}, false, nil
  case 'B':
    p.pos++
    if inClass {
      // Annex B: `[\B]` is an identity escape.
      return escapedSimpleChar('B'), true, nil
    }
    return &regexAssertionNode{Kind: "\\B"}, false, nil
  case 'c':
    if p.pos+1 < len(p.src) && isASCIILetter(p.src[p.pos+1]) {
      value := "\\c" + string(p.src[p.pos+1])
      p.pos += 2
      return &regexCharNode{Value: value, Kind: "control"}, true, nil
    }
    // SAFETY: a dangling `\c` matches the two characters `\` and `c` in
    // JavaScript (Annex B). regexp-tree unescapes it to a bare `c`,
    // corrupting the match; keep it as an inert control-kind Char that
    // regenerates verbatim instead.
    p.pos++
    return &regexCharNode{Value: "\\c", Kind: "control"}, true, nil
  case 'x':
    if p.pos+2 < len(p.src) && isHexDigit(p.src[p.pos+1]) && isHexDigit(p.src[p.pos+2]) {
      hex := string(p.src[p.pos+1 : p.pos+3])
      cp, _ := strconv.ParseInt(hex, 16, 32)
      value := "\\x" + hex
      p.pos += 3
      return &regexCharNode{
        Value: value, Kind: "hex",
        Symbol: string(rune(cp)), SymbolState: regexFieldValue,
        CodePoint: int(cp), CodePointState: regexFieldValue,
      }, true, nil
    }
    if p.uMode || p.vMode {
      return nil, false, p.errorAt(p.pos-1, "invalid hexadecimal escape")
    }
    p.pos++
    return escapedSimpleChar('x'), true, nil
  case 'u':
    node, ok, err := p.parseUnicodeEscape()
    if err != nil {
      return nil, false, err
    }
    if ok {
      return node, true, nil
    }
    if p.uMode || p.vMode {
      return nil, false, p.errorAt(p.pos-1, "invalid unicode escape")
    }
    p.pos++
    return escapedSimpleChar('u'), true, nil
  case 'p', 'P':
    if p.uMode || p.vMode {
      return p.parseUnicodeProperty(r == 'P')
    }
    p.pos++
    return escapedSimpleChar(r), true, nil
  case 'k':
    if !inClass && len(p.groupNames) > 0 {
      if node, ok := p.tryParseNamedBackreference(); ok {
        return node, true, nil
      }
    }
    p.pos++
    return escapedSimpleChar('k'), true, nil
  case '0':
    // `\0` (not followed by another digit) is NUL, kind "decimal" in
    // regexp-tree. With a following octal digit it is a legacy octal
    // escape.
    if p.pos+1 >= len(p.src) || !isOctalDigit(p.src[p.pos+1]) {
      p.pos++
      return &regexCharNode{
        Value: "\\0", Kind: "decimal",
        Symbol: "\x00", SymbolState: regexFieldValue,
        CodePoint: 0, CodePointState: regexFieldValue,
      }, true, nil
    }
    return p.parseLegacyOctal()
  case '1', '2', '3', '4', '5', '6', '7', '8', '9':
    if !inClass {
      // DecimalEscape: a backreference when the whole decimal run does
      // not exceed the pattern's capture-group count.
      end := p.pos
      for end < len(p.src) && p.src[end] >= '0' && p.src[end] <= '9' {
        end++
      }
      number, err := strconv.Atoi(string(p.src[p.pos:end]))
      if err == nil && number <= p.groupCount {
        p.pos = end
        return &regexBackreferenceNode{Kind: "number", Number: number}, true, nil
      }
    }
    if r == '8' || r == '9' {
      // Annex B: `\8` and `\9` match the plain digits. regexp-tree gives
      // them an inert "decimal" kind so no transform touches them; mirror
      // that with a NaN code point (regexp-tree's bogus non-digit code
      // point could merge them into unrelated ranges).
      p.pos++
      return &regexCharNode{
        Value: "\\" + string(r), Kind: "decimal",
        CodePointState: regexFieldNaN,
      }, true, nil
    }
    return p.parseLegacyOctal()
  default:
    if p.uMode || p.vMode {
      // In unicode modes only syntax characters may be identity-escaped.
      if !strings.ContainsRune("^$\\.*+?()[]{}|/-", r) {
        return nil, false, p.errorAt(p.pos-1, fmt.Sprintf("invalid identity escape %q", "\\"+string(r)))
      }
    }
    p.pos++
    return escapedSimpleChar(r), true, nil
  }
}

// parseLegacyOctal consumes an Annex B LegacyOctalEscapeSequence starting
// at the current digit. SAFETY: regexp-tree parses multi-digit `\NNN`
// escapes as *decimal* character codes, so its optimizer rewrites /\101/
// (octal for "A") into /e/ (decimal 101); this port applies the real
// ECMAScript octal semantics so the rewrite stays meaning-preserving.
func (p *regexParser) parseLegacyOctal() (regexNode, bool, error) {
  start := p.pos
  first := p.src[p.pos]
  length := 1
  if first <= '3' {
    for length < 3 && p.pos+length < len(p.src) && isOctalDigit(p.src[p.pos+length]) {
      length++
    }
  } else {
    if p.pos+1 < len(p.src) && isOctalDigit(p.src[p.pos+1]) {
      length = 2
    }
  }
  digits := string(p.src[start : start+length])
  cp, _ := strconv.ParseInt(digits, 8, 32)
  p.pos += length
  return &regexCharNode{
    Value: "\\" + digits, Kind: "oct",
    Symbol: string(rune(cp)), SymbolState: regexFieldValue,
    CodePoint: int(cp), CodePointState: regexFieldValue,
  }, true, nil
}

// parseUnicodeEscape handles `\uXXXX` and, in u/v mode, `\u{...}` plus
// surrogate-pair combining. Positioned on the `u`. Returns ok=false when
// the escape body is malformed (Annex B identity fallback).
func (p *regexParser) parseUnicodeEscape() (regexNode, bool, error) {
  braces := p.uMode || p.vMode
  body := p.src[p.pos+1:]
  r, consumed, ok := decodeUnicodeEscapeBody(body, braces)
  if !ok {
    return nil, false, nil
  }
  raw := "\\u" + string(body[:consumed])
  if braces && consumed >= 1 && body[0] != '{' && isHighSurrogate(int(r)) {
    // Try to combine a trailing low surrogate escape into one code point,
    // the way regexp-tree and the unicode-mode grammar do.
    rest := body[consumed:]
    if len(rest) >= 2 && rest[0] == '\\' && rest[1] == 'u' {
      low, lowConsumed, lowOK := decodeUnicodeEscapeBody(rest[2:], false)
      if lowOK && isLowSurrogate(int(low)) {
        combined := 0x10000 + (int(r)-0xd800)*0x400 + (int(low) - 0xdc00)
        value := raw + "\\u" + string(rest[2:2+lowConsumed])
        p.pos += 1 + consumed + 2 + lowConsumed
        return &regexCharNode{
          Value: value, Kind: "unicode",
          Symbol: string(rune(combined)), SymbolState: regexFieldValue,
          CodePoint: combined, CodePointState: regexFieldValue,
          SurrogatePair: true,
        }, true, nil
      }
    }
  }
  p.pos += 1 + consumed
  return &regexCharNode{
    Value: raw, Kind: "unicode",
    Symbol: string(r), SymbolState: regexFieldValue,
    CodePoint: int(r), CodePointState: regexFieldValue,
  }, true, nil
}

// parseUnicodeProperty parses `\p{...}` / `\P{...}` bodies. Positioned on
// the `p`/`P`.
func (p *regexParser) parseUnicodeProperty(negative bool) (regexNode, bool, error) {
  if p.pos+1 >= len(p.src) || p.src[p.pos+1] != '{' {
    return nil, false, p.errorAt(p.pos-1, "invalid unicode property escape")
  }
  end := p.pos + 2
  for end < len(p.src) && p.src[end] != '}' {
    end++
  }
  if end >= len(p.src) {
    return nil, false, p.errorEOF()
  }
  bodyRunes := p.src[p.pos+2 : end]
  body := string(bodyRunes)
  if body == "" || !isUnicodePropertyBody(bodyRunes) {
    return nil, false, p.errorAt(p.pos-1, "invalid unicode property escape")
  }
  p.pos = end + 1
  node := &regexUnicodePropertyNode{Negative: negative}
  if eq := strings.IndexByte(body, '='); eq >= 0 {
    node.Name = body[:eq]
    node.Value = body[eq+1:]
  } else {
    // Bare form: either a General_Category shorthand or a binary
    // property. The distinction only affects regeneration, and both
    // regenerate without a name part.
    node.Name = body
    node.Value = body
    node.Binary = true
  }
  return node, true, nil
}

func isUnicodePropertyBody(runes []rune) bool {
  seenEq := false
  for _, r := range runes {
    if r == '=' {
      if seenEq {
        return false
      }
      seenEq = true
      continue
    }
    if !(r == '_' || r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9') {
      return false
    }
  }
  return true
}

// tryParseNamedBackreference parses `\k<name>` where at least one named
// group exists. Positioned on the `k`. Falls back (returns false) when the
// name is missing or unknown, matching regexp-tree's literal fallback.
func (p *regexParser) tryParseNamedBackreference() (regexNode, bool) {
  if p.pos+1 >= len(p.src) || p.src[p.pos+1] != '<' {
    return nil, false
  }
  end := p.pos + 2
  for end < len(p.src) && p.src[end] != '>' {
    end++
  }
  if end >= len(p.src) {
    return nil, false
  }
  name, raw, err := p.decodeGroupName(p.src[p.pos+2 : end])
  if err != nil || !p.groupNames[name] {
    return nil, false
  }
  p.pos = end + 1
  return &regexBackreferenceNode{
    Kind: "name", Reference: name, ReferenceRaw: raw,
  }, true
}

// parseCharacterClass parses `[...]`. In v mode, classes that use set
// notation are captured as opaque nodes.
func (p *regexParser) parseCharacterClass() (regexNode, error) {
  start := p.pos
  if p.vMode {
    if node, handled, err := p.tryParseOpaqueClassSet(); handled {
      return node, err
    }
  }
  p.pos++ // consume '['
  node := &regexClassNode{LocStart: start}
  if p.pos < len(p.src) && p.src[p.pos] == '^' {
    node.Negative = true
    p.pos++
  }
  for {
    if p.pos >= len(p.src) {
      return nil, p.errorEOF()
    }
    if p.src[p.pos] == ']' {
      p.pos++
      node.LocEnd = p.pos
      return node, nil
    }
    atom, err := p.parseClassAtom()
    if err != nil {
      return nil, err
    }
    // Try to form a ClassRange: `atom - atom` where the dash is not the
    // final character before `]`.
    if p.pos+1 < len(p.src) && p.src[p.pos] == '-' && p.src[p.pos+1] != ']' {
      fromChar, fromIsChar := atom.(*regexCharNode)
      if fromIsChar {
        p.pos++ // consume '-'
        toAtom, err := p.parseClassAtom()
        if err != nil {
          return nil, err
        }
        toChar, toIsChar := toAtom.(*regexCharNode)
        if !toIsChar {
          return nil, p.errorAt(p.pos, "invalid character class range")
        }
        if !fromChar.codePointIsNaN() && !toChar.codePointIsNaN() &&
          fromChar.CodePoint > toChar.CodePoint {
          return nil, &regexParseError{
            Message: fmt.Sprintf("range %s-%s out of order in character class",
              fromChar.Value, toChar.Value),
          }
        }
        node.Expressions = append(node.Expressions, &regexClassRangeNode{From: fromChar, To: toChar})
        continue
      }
    }
    node.Expressions = append(node.Expressions, atom)
  }
}

// tryParseOpaqueClassSet detects v-mode set notation (nested classes,
// `--`/`&&` operators, `\q{...}`) and consumes the whole class verbatim.
// Returns handled=false when the class body is flat and the normal parser
// should read it.
func (p *regexParser) tryParseOpaqueClassSet() (regexNode, bool, error) {
  depth := 0
  exotic := false
  i := p.pos
  for i < len(p.src) {
    switch p.src[i] {
    case '\\':
      if i+1 < len(p.src) && p.src[i+1] == 'q' {
        exotic = true
      }
      i++
    case '[':
      depth++
      if depth > 1 {
        exotic = true
      }
    case ']':
      depth--
      if depth == 0 {
        if !exotic {
          return nil, false, nil
        }
        raw := string(p.src[p.pos : i+1])
        node := &regexClassSetNode{Raw: raw, LocStart: p.pos, LocEnd: i + 1}
        p.pos = i + 1
        return node, true, nil
      }
    case '-':
      if i+1 < len(p.src) && p.src[i+1] == '-' {
        exotic = true
      }
    case '&':
      if i+1 < len(p.src) && p.src[i+1] == '&' {
        exotic = true
      }
    }
    i++
  }
  return nil, true, p.errorEOF()
}

// parseClassAtom parses one class member (a char or escape).
func (p *regexParser) parseClassAtom() (regexNode, error) {
  r := p.src[p.pos]
  if r == '\\' {
    node, _, err := p.parseEscape(true)
    if err != nil {
      return nil, err
    }
    return node, nil
  }
  p.pos++
  return simpleChar(r), nil
}

func isASCIILetter(r rune) bool {
  return r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z'
}

func isHexDigit(r rune) bool {
  return r >= '0' && r <= '9' || r >= 'a' && r <= 'f' || r >= 'A' && r <= 'F'
}

func isOctalDigit(r rune) bool {
  return r >= '0' && r <= '7'
}

func isHighSurrogate(cp int) bool { return cp >= 0xd800 && cp <= 0xdbff }
func isLowSurrogate(cp int) bool  { return cp >= 0xdc00 && cp <= 0xdfff }

// regexUTF16Length measures a string in UTF-16 code units, matching the
// JavaScript String#length the upstream optimizer's shorter-or-equal
// rollback guard compares.
func regexUTF16Length(s string) int {
  n := 0
  for _, r := range s {
    n += len(utf16.Encode([]rune{r}))
  }
  return n
}
