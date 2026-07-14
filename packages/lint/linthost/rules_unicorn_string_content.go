// unicorn/string-content rewrites configured substrings inside string
// literals and template quasis (e.g. straight quotes -> curly quotes,
// `...` -> `…`). The rule has NO default patterns: behavior depends
// entirely on the user-supplied `patterns: { match: replacement }`
// configuration, so a bare severity is intentionally silent.
//
// Faithful to the current upstream semantics: the first configured
// pattern whose regular expression matches a node's text wins and every
// occurrence is replaced; string literals match on their cooked value
// and are re-quoted with escapes, template quasis match on their raw
// text and re-escape backticks and `${`; gql/html/sql/svg tags and
// `styled.*` member tags exempt their template quasis; JSX attribute
// strings encode the delimiter quote as an HTML entity; `fix: false`
// downgrades the rewrite to an editor suggestion; `selectors` restrict
// the checked nodes through AST selectors.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/rules/string-content.js
package linthost

import (
  "bytes"
  "encoding/json"
  "fmt"
  "regexp"
  "sort"
  "strconv"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

const (
  unicornStringContentDefaultMessage    = "Prefer `{{suggest}}` over `{{match}}`."
  unicornStringContentSuggestionMessage = "Replace `{{match}}` with `{{suggest}}`."
)

// unicornStringContentIgnoredIdentifierTags lists template tags whose quasis
// embed foreign languages, mirroring upstream's `ignoredIdentifier` set.
var unicornStringContentIgnoredIdentifierTags = map[string]struct{}{
  "gql":  {},
  "html": {},
  "sql":  {},
  "svg":  {},
}

// unicornStringContentIgnoredMemberObjects lists member-expression tag
// objects (`styled.div`), mirroring upstream's `ignoredMemberExpressionObject`.
var unicornStringContentIgnoredMemberObjects = map[string]struct{}{
  "styled": {},
}

type unicornStringContent struct{}

type unicornStringContentPattern struct {
  match         string
  suggest       string
  fix           bool
  caseSensitive bool
  message       string
  messageSet    bool
  regex         *regexp.Regexp
}

type unicornStringContentOptions struct {
  patterns  []unicornStringContentPattern
  selectors []*astSelector
}

func (unicornStringContent) Name() string           { return "unicorn/string-content" }
func (unicornStringContent) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }

// ValidateOptions is consumed by the engine's optional rule-options
// validation interface so malformed patterns and selectors become a project
// configuration error before any file is linted.
func (unicornStringContent) ValidateOptions(raw json.RawMessage) error {
  _, err := parseUnicornStringContentOptions(raw)
  return err
}

func (unicornStringContent) Check(ctx *Context, root *shimast.Node) {
  if ctx == nil || ctx.File == nil || root == nil {
    return
  }
  options, err := parseUnicornStringContentOptions(ctx.Options)
  if err != nil || len(options.patterns) == 0 {
    // Engine construction already records malformed options as a
    // ConfigError; Check stays side-effect-free for direct calls.
    return
  }
  source := ctx.File.Text()
  for _, target := range collectUnicornStringContentTargets(root, options.selectors) {
    checkUnicornStringContentNode(ctx, source, target, options.patterns)
  }
}

// parseUnicornStringContentOptions decodes the single `{patterns, selectors}`
// option slot. The patterns object is decoded with a token stream so the
// configured replacement order is preserved: upstream applies the FIRST
// matching pattern per node, so ordering is behavior, not presentation.
func parseUnicornStringContentOptions(raw json.RawMessage) (unicornStringContentOptions, error) {
  var options unicornStringContentOptions
  raw = bytes.TrimSpace(raw)
  if len(raw) == 0 || bytes.Equal(raw, []byte("null")) {
    return options, nil
  }
  if raw[0] != '{' {
    return options, fmt.Errorf("unicorn/string-content options must be a single object with %q and/or %q", "patterns", "selectors")
  }

  decoder := json.NewDecoder(bytes.NewReader(raw))
  if _, err := decoder.Token(); err != nil {
    return options, fmt.Errorf("unicorn/string-content options must be valid JSON: %w", err)
  }
  for decoder.More() {
    keyToken, err := decoder.Token()
    if err != nil {
      return options, fmt.Errorf("unicorn/string-content options must be valid JSON: %w", err)
    }
    key, ok := keyToken.(string)
    if !ok {
      return options, fmt.Errorf("unicorn/string-content options must be valid JSON")
    }
    var value json.RawMessage
    if err := decoder.Decode(&value); err != nil {
      return options, fmt.Errorf("unicorn/string-content option %q must be valid JSON: %w", key, err)
    }
    switch key {
    case "patterns":
      patterns, err := parseUnicornStringContentPatterns(value)
      if err != nil {
        return options, err
      }
      options.patterns = patterns
    case "selectors":
      selectors, err := parseUnicornStringContentSelectors(value)
      if err != nil {
        return options, err
      }
      options.selectors = selectors
    default:
      return options, fmt.Errorf("unicorn/string-content options contain unknown key %q (want patterns, selectors)", key)
    }
  }
  if _, err := decoder.Token(); err != nil {
    return options, fmt.Errorf("unicorn/string-content options must be valid JSON: %w", err)
  }
  return options, nil
}

// parseUnicornStringContentPatterns decodes the `patterns` object in JS
// property-enumeration order: canonical array-index keys ascending first,
// then string keys in insertion order (`Object.entries` semantics). A
// duplicate JSON key keeps its first position with its last value, matching
// `JSON.parse`.
func parseUnicornStringContentPatterns(raw json.RawMessage) ([]unicornStringContentPattern, error) {
  raw = bytes.TrimSpace(raw)
  if len(raw) == 0 || raw[0] != '{' {
    return nil, fmt.Errorf("unicorn/string-content option %q must be an object mapping regex patterns to replacements", "patterns")
  }
  decoder := json.NewDecoder(bytes.NewReader(raw))
  if _, err := decoder.Token(); err != nil {
    return nil, fmt.Errorf("unicorn/string-content option %q must be valid JSON: %w", "patterns", err)
  }
  patterns := make([]unicornStringContentPattern, 0)
  indexes := make(map[string]int)
  for decoder.More() {
    keyToken, err := decoder.Token()
    if err != nil {
      return nil, fmt.Errorf("unicorn/string-content option %q must be valid JSON: %w", "patterns", err)
    }
    match, ok := keyToken.(string)
    if !ok {
      return nil, fmt.Errorf("unicorn/string-content option %q must be valid JSON", "patterns")
    }
    var value json.RawMessage
    if err := decoder.Decode(&value); err != nil {
      return nil, fmt.Errorf("unicorn/string-content pattern %q must be valid JSON: %w", match, err)
    }
    pattern, err := parseUnicornStringContentPattern(match, value)
    if err != nil {
      return nil, err
    }
    if index, duplicate := indexes[match]; duplicate {
      patterns[index] = pattern
      continue
    }
    indexes[match] = len(patterns)
    patterns = append(patterns, pattern)
  }
  if _, err := decoder.Token(); err != nil {
    return nil, fmt.Errorf("unicorn/string-content option %q must be valid JSON: %w", "patterns", err)
  }
  return sortUnicornStringContentPatterns(patterns), nil
}

// parseUnicornStringContentPattern decodes one replacement entry: a bare
// string is shorthand for `{suggest}`; the object form carries the optional
// `fix`, `caseSensitive`, and `message` switches.
func parseUnicornStringContentPattern(match string, raw json.RawMessage) (unicornStringContentPattern, error) {
  pattern := unicornStringContentPattern{match: match, fix: true, caseSensitive: true}
  raw = bytes.TrimSpace(raw)
  if len(raw) == 0 {
    return pattern, fmt.Errorf("unicorn/string-content pattern %q must be a replacement string or an object with %q", match, "suggest")
  }
  switch raw[0] {
  case '"':
    if err := decodeStrictJSON(raw, &pattern.suggest); err != nil {
      return pattern, fmt.Errorf("unicorn/string-content pattern %q must be a replacement string: %w", match, err)
    }
  case '{':
    object := struct {
      Suggest       json.RawMessage `json:"suggest"`
      Fix           json.RawMessage `json:"fix"`
      CaseSensitive json.RawMessage `json:"caseSensitive"`
      Message       json.RawMessage `json:"message"`
    }{}
    if err := decodeStrictJSON(raw, &object); err != nil {
      return pattern, fmt.Errorf("unicorn/string-content pattern %q must contain only suggest, fix, caseSensitive, and message: %w", match, err)
    }
    if len(object.Suggest) == 0 {
      return pattern, fmt.Errorf("unicorn/string-content pattern %q requires %q", match, "suggest")
    }
    if err := decodeStrictJSON(object.Suggest, &pattern.suggest); err != nil {
      return pattern, fmt.Errorf("unicorn/string-content pattern %q option %q must be a string: %w", match, "suggest", err)
    }
    if len(object.Fix) > 0 {
      if err := decodeStrictJSON(object.Fix, &pattern.fix); err != nil {
        return pattern, fmt.Errorf("unicorn/string-content pattern %q option %q must be a boolean: %w", match, "fix", err)
      }
    }
    if len(object.CaseSensitive) > 0 {
      if err := decodeStrictJSON(object.CaseSensitive, &pattern.caseSensitive); err != nil {
        return pattern, fmt.Errorf("unicorn/string-content pattern %q option %q must be a boolean: %w", match, "caseSensitive", err)
      }
    }
    if len(object.Message) > 0 {
      if err := decodeStrictJSON(object.Message, &pattern.message); err != nil {
        return pattern, fmt.Errorf("unicorn/string-content pattern %q option %q must be a string: %w", match, "message", err)
      }
      pattern.messageSet = true
    }
  default:
    return pattern, fmt.Errorf("unicorn/string-content pattern %q must be a replacement string or an object with %q", match, "suggest")
  }

  expression := match
  if !pattern.caseSensitive {
    expression = "(?i:" + expression + ")"
  }
  regex, err := regexp.Compile(expression)
  if err != nil {
    return pattern, fmt.Errorf("unicorn/string-content pattern %q must be a valid regular expression: %w", match, err)
  }
  pattern.regex = regex
  return pattern, nil
}

// sortUnicornStringContentPatterns applies JS property-enumeration order:
// canonical array-index keys ("0", "7", "42") are enumerated first in
// ascending numeric order, everything else keeps insertion order.
func sortUnicornStringContentPatterns(patterns []unicornStringContentPattern) []unicornStringContentPattern {
  integers := make([]unicornStringContentPattern, 0)
  others := make([]unicornStringContentPattern, 0, len(patterns))
  for _, pattern := range patterns {
    if _, ok := unicornStringContentArrayIndexKey(pattern.match); ok {
      integers = append(integers, pattern)
    } else {
      others = append(others, pattern)
    }
  }
  if len(integers) == 0 {
    return others
  }
  sort.SliceStable(integers, func(left, right int) bool {
    leftKey, _ := unicornStringContentArrayIndexKey(integers[left].match)
    rightKey, _ := unicornStringContentArrayIndexKey(integers[right].match)
    return leftKey < rightKey
  })
  return append(integers, others...)
}

// unicornStringContentArrayIndexKey reports whether `key` is a canonical
// ECMAScript array index (an unsigned decimal integer below 2^32-1 with no
// leading zeros), the class of property keys JS enumerates first.
func unicornStringContentArrayIndexKey(key string) (uint64, bool) {
  if key == "" || len(key) > 10 {
    return 0, false
  }
  if key[0] == '0' {
    if key == "0" {
      return 0, true
    }
    return 0, false
  }
  for index := 0; index < len(key); index++ {
    if key[index] < '0' || key[index] > '9' {
      return 0, false
    }
  }
  value, err := strconv.ParseUint(key, 10, 64)
  if err != nil || value > 4294967294 {
    return 0, false
  }
  return value, true
}

// parseUnicornStringContentSelectors decodes and compiles the `selectors`
// list. The upstream schema requires unique string items; each entry is
// compiled through the shared AST-selector grammar.
func parseUnicornStringContentSelectors(raw json.RawMessage) ([]*astSelector, error) {
  raw = bytes.TrimSpace(raw)
  if len(raw) == 0 || raw[0] != '[' {
    return nil, fmt.Errorf("unicorn/string-content option %q must be an array of unique strings", "selectors")
  }
  var sources []string
  if err := decodeStrictJSON(raw, &sources); err != nil {
    return nil, fmt.Errorf("unicorn/string-content option %q must be an array of unique strings: %w", "selectors", err)
  }
  seen := make(map[string]struct{}, len(sources))
  selectors := make([]*astSelector, 0, len(sources))
  for index, source := range sources {
    if _, duplicate := seen[source]; duplicate {
      return nil, fmt.Errorf("unicorn/string-content option %q must not contain duplicate %q", "selectors", source)
    }
    seen[source] = struct{}{}
    selector, err := parseASTSelector(source)
    if err != nil {
      return nil, fmt.Errorf("unicorn/string-content selector %d %q is invalid: %w", index+1, source, err)
    }
    selectors = append(selectors, selector)
  }
  return selectors, nil
}

// collectUnicornStringContentTargets gathers the string-shaped nodes to
// check. Without selectors every string literal and template quasi is a
// target (upstream's `Literal` + `TemplateElement` listener); with selectors
// only selected nodes of those shapes are, each checked once even when
// multiple selectors reach it.
func collectUnicornStringContentTargets(root *shimast.Node, selectors []*astSelector) []*shimast.Node {
  targets := make([]*shimast.Node, 0)
  if len(selectors) == 0 {
    walkDescendants(root, func(node *shimast.Node) {
      if isUnicornStringContentTarget(node) {
        targets = append(targets, node)
      }
    })
    return targets
  }
  seen := make(map[*shimast.Node]struct{})
  for _, selector := range selectors {
    for _, match := range matchASTSelector(root, selector) {
      if !isUnicornStringContentTarget(match) {
        continue
      }
      if _, duplicate := seen[match]; duplicate {
        continue
      }
      seen[match] = struct{}{}
      targets = append(targets, match)
    }
  }
  sort.SliceStable(targets, func(left, right int) bool {
    return targets[left].Pos() < targets[right].Pos()
  })
  return targets
}

// isUnicornStringContentTarget mirrors upstream's target node types: ESTree
// `Literal` (only string literals can carry a string value) and
// `TemplateElement` (TemplateHead/Middle/Tail plus the quasi of a
// no-substitution template).
func isUnicornStringContentTarget(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindStringLiteral,
    shimast.KindNoSubstitutionTemplateLiteral,
    shimast.KindTemplateHead,
    shimast.KindTemplateMiddle,
    shimast.KindTemplateTail:
    return true
  }
  return false
}

func checkUnicornStringContentNode(
  ctx *Context,
  source string,
  node *shimast.Node,
  patterns []unicornStringContentPattern,
) {
  if node.Kind == shimast.KindStringLiteral {
    // Upstream matches string literals on the COOKED value and skips
    // empty strings (`if (!string) return`).
    value := stringLiteralText(node)
    if value == "" {
      return
    }
    replacement, ok := findUnicornStringContentReplacement(patterns, value)
    if !ok {
      return
    }
    fixed := replacement.regex.ReplaceAllLiteralString(value, replacement.suggest)
    reportUnicornStringContent(ctx, node, replacement, unicornStringContentLiteralEdits(source, node, fixed))
    return
  }

  // Template quasis match on their RAW text so escape spelling and
  // substitution boundaries stay untouched. Foreign-language tags are
  // exempt even when the quasi was reached through a configured selector.
  if unicornStringContentHasIgnoredTag(node) {
    return
  }
  innerPos, innerEnd, ok := unicornStringContentTemplateInnerRange(source, node)
  if !ok {
    return
  }
  raw := unicornStringContentNormalizeTemplateRaw(source[innerPos:innerEnd])
  if raw == "" {
    return
  }
  replacement, ok := findUnicornStringContentReplacement(patterns, raw)
  if !ok {
    return
  }
  fixed := replacement.regex.ReplaceAllLiteralString(raw, replacement.suggest)
  edits := []TextEdit{{Pos: innerPos, End: innerEnd, Text: unicornStringContentEscapeTemplateRaw(fixed)}}
  reportUnicornStringContent(ctx, node, replacement, edits)
}

// unicornStringContentTemplateNewlinePattern is acorn's TemplateElement raw
// normalization (`raw.replace(/\r\n?/g, "\n")` in parseTemplateElement).
var unicornStringContentTemplateNewlinePattern = regexp.MustCompile(`\r\n?`)

// unicornStringContentNormalizeTemplateRaw reproduces the raw value ESLint
// sees for a template quasi: acorn materializes `TemplateElement.value.raw`
// with CR / CRLF collapsed to LF, so upstream both matches patterns against
// and rewrites from the LF-normalized text. A reported quasi that contained
// CRLF therefore comes back LF-only after the fix, exactly like upstream.
func unicornStringContentNormalizeTemplateRaw(raw string) string {
  return unicornStringContentTemplateNewlinePattern.ReplaceAllString(raw, "\n")
}

// findUnicornStringContentReplacement returns the FIRST configured pattern
// whose regular expression matches, mirroring upstream's
// `replacements.find(({regex}) => regex.test(string))`.
func findUnicornStringContentReplacement(
  patterns []unicornStringContentPattern,
  subject string,
) (unicornStringContentPattern, bool) {
  for _, pattern := range patterns {
    if pattern.regex.MatchString(subject) {
      return pattern, true
    }
  }
  return unicornStringContentPattern{}, false
}

func reportUnicornStringContent(
  ctx *Context,
  node *shimast.Node,
  replacement unicornStringContentPattern,
  edits []TextEdit,
) {
  data := map[string]string{
    "match":   replacement.match,
    "suggest": replacement.suggest,
  }
  template := unicornStringContentDefaultMessage
  if replacement.messageSet {
    template = replacement.message
  }
  message := unicornStringContentInterpolate(template, data)
  if replacement.fix {
    ctx.ReportFix(node, message, edits...)
    return
  }
  title := unicornStringContentInterpolate(unicornStringContentSuggestionMessage, data)
  ctx.ReportSuggestion(node, message, title, edits...)
}

// unicornStringContentPlaceholderPattern mirrors ESLint's message-data
// interpolation syntax (`{{ term }}`).
var unicornStringContentPlaceholderPattern = regexp.MustCompile(`\{\{([^{}]+?)\}\}`)

func unicornStringContentInterpolate(template string, data map[string]string) string {
  return unicornStringContentPlaceholderPattern.ReplaceAllStringFunc(template, func(placeholder string) string {
    term := strings.TrimSpace(placeholder[2 : len(placeholder)-2])
    if value, ok := data[term]; ok {
      return value
    }
    return placeholder
  })
}

// unicornStringContentHasIgnoredTag reports whether a template quasi belongs
// to a tagged template whose tag is one of the ignored identifiers
// (gql/html/sql/svg) or a member expression on `styled`.
func unicornStringContentHasIgnoredTag(element *shimast.Node) bool {
  template := element
  switch element.Kind {
  case shimast.KindTemplateHead:
    template = element.Parent
  case shimast.KindTemplateMiddle, shimast.KindTemplateTail:
    if element.Parent == nil {
      return false
    }
    template = element.Parent.Parent
  }
  if template == nil || template.Parent == nil || template.Parent.Kind != shimast.KindTaggedTemplateExpression {
    return false
  }
  tagged := template.Parent.AsTaggedTemplateExpression()
  if tagged == nil || tagged.Template != template || tagged.Tag == nil {
    return false
  }
  tag := stripParens(tagged.Tag)
  if tag == nil {
    return false
  }
  if name := identifierText(tag); name != "" {
    _, ignored := unicornStringContentIgnoredIdentifierTags[name]
    return ignored
  }
  var object *shimast.Node
  switch tag.Kind {
  case shimast.KindPropertyAccessExpression:
    if access := tag.AsPropertyAccessExpression(); access != nil {
      object = access.Expression
    }
  case shimast.KindElementAccessExpression:
    if access := tag.AsElementAccessExpression(); access != nil {
      object = access.Expression
    }
  default:
    return false
  }
  if name := identifierText(stripParens(object)); name != "" {
    _, ignored := unicornStringContentIgnoredMemberObjects[name]
    return ignored
  }
  return false
}

// unicornStringContentTemplateInnerRange bounds the raw quasi payload of a
// template element: the text between the enclosing backtick / `${` / `}`
// delimiters. Mirrors upstream's `replaceTemplateElement` arithmetic
// (`[start + 1, end - (tail ? 1 : 2)]`).
func unicornStringContentTemplateInnerRange(source string, node *shimast.Node) (int, int, bool) {
  start := shimscanner.SkipTrivia(source, node.Pos())
  end := node.End()
  if start < 0 || end > len(source) || start >= end {
    return 0, 0, false
  }
  switch node.Kind {
  case shimast.KindNoSubstitutionTemplateLiteral:
    if start+2 > end || source[start] != '`' || source[end-1] != '`' {
      return 0, 0, false
    }
    return start + 1, end - 1, true
  case shimast.KindTemplateHead:
    if start+3 > end || source[start] != '`' || source[end-2:end] != "${" {
      return 0, 0, false
    }
    return start + 1, end - 2, true
  case shimast.KindTemplateMiddle:
    if start+3 > end || source[start] != '}' || source[end-2:end] != "${" {
      return 0, 0, false
    }
    return start + 1, end - 2, true
  case shimast.KindTemplateTail:
    if start+2 > end || source[start] != '}' || source[end-1] != '`' {
      return 0, 0, false
    }
    return start + 1, end - 1, true
  }
  return 0, 0, false
}

// unicornStringContentLiteralEdits rewrites a whole string literal with the
// replaced cooked value. JSX attribute strings cannot use backslash escapes,
// so the delimiter quote is encoded as an HTML entity (which JSX decodes)
// instead; everywhere else the value is re-escaped and re-quoted.
func unicornStringContentLiteralEdits(source string, node *shimast.Node, fixed string) []TextEdit {
  start := shimscanner.SkipTrivia(source, node.Pos())
  end := node.End()
  if start < 0 || end > len(source) || start >= end {
    return nil
  }
  quote := source[start]
  if quote != '\'' && quote != '"' {
    return nil
  }
  if node.Parent != nil && node.Parent.Kind == shimast.KindJsxAttribute {
    entity := "&#39;"
    if quote == '"' {
      entity = "&quot;"
    }
    text := string(quote) + strings.ReplaceAll(fixed, string(quote), entity) + string(quote)
    return []TextEdit{{Pos: start, End: end, Text: text}}
  }
  return []TextEdit{{Pos: start, End: end, Text: escapeString(fixed, quote)}}
}

// unicornStringContentEscapeTemplateRaw ports upstream's
// escapeTemplateElementRaw: a backtick or `${`-starting dollar preceded by
// an even number of backslashes (i.e. not already escaped) gains one.
func unicornStringContentEscapeTemplateRaw(text string) string {
  var out strings.Builder
  out.Grow(len(text))
  backslashes := 0
  for index := 0; index < len(text); index++ {
    character := text[index]
    if character == '\\' {
      backslashes++
      out.WriteByte(character)
      continue
    }
    if backslashes%2 == 0 &&
      (character == '`' || character == '$' && index+1 < len(text) && text[index+1] == '{') {
      out.WriteByte('\\')
    }
    backslashes = 0
    out.WriteByte(character)
  }
  return out.String()
}

func init() {
  Register(unicornStringContent{})
}
