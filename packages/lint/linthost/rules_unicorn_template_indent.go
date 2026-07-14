// unicorn/template-indent normalizes whitespace-insensitive template bodies
// selected by tag, call argument, leading block comment, AST selector, or the
// Jest inline-snapshot shape. Edits target only the raw TemplateHead / Middle /
// Tail payloads, so substitutions, nested expressions, and escape spelling are
// preserved byte-for-byte.
//
// The indentation pipeline mirrors the current upstream rule: remove the
// common body margin, trim only the boundary line breaks, then indent every
// non-empty line relative to the source line that contains the opening
// backtick. Source-wide indent detection excludes the interior lines of every
// template so template data cannot decide the surrounding code style.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/rules/template-indent.js
package linthost

import (
  "bytes"
  "encoding/json"
  "fmt"
  "sort"
  "strings"
  "unicode"
  "unicode/utf8"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

const unicornTemplateIndentMessage = "Templates should be properly indented."

var (
  unicornTemplateIndentDefaultTags = []string{
    "outdent", "dedent", "gql", "sql", "html", "styled",
  }
  unicornTemplateIndentDefaultFunctions = []string{"dedent", "stripIndent"}
  unicornTemplateIndentDefaultComments  = []string{"HTML", "indent"}
)

type unicornTemplateIndent struct{}

type unicornTemplateIndentRawOptions struct {
  Indent    json.RawMessage `json:"indent"`
  Tags      json.RawMessage `json:"tags"`
  Functions json.RawMessage `json:"functions"`
  Selectors json.RawMessage `json:"selectors"`
  Comments  json.RawMessage `json:"comments"`
}

type unicornTemplateIndentOptions struct {
  indent    string
  indentSet bool
  tags      []string
  functions []string
  selectors []*astSelector
  comments  []string
}

type unicornTemplateIndentQuasi struct {
  pos  int
  end  int
  text string
}

type unicornTemplateIndentStat struct {
  kind   byte
  amount int
  uses   int
  weight int
}

type unicornTemplateIndentLine struct {
  text       string
  terminator string
}

func (unicornTemplateIndent) Name() string { return "unicorn/template-indent" }
func (unicornTemplateIndent) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}

func (unicornTemplateIndent) ValidateOptions(raw json.RawMessage) error {
  _, err := compileUnicornTemplateIndentOptions(raw)
  return err
}

func (unicornTemplateIndent) Check(ctx *Context, root *shimast.Node) {
  if ctx == nil || ctx.File == nil || root == nil {
    return
  }
  options, err := compileUnicornTemplateIndentOptions(ctx.Options)
  if err != nil {
    // Engine construction reports malformed options as a configuration error.
    // Direct contributor calls that bypass construction remain side-effect-free.
    return
  }

  source := ctx.File.Text()
  templates := collectUnicornTemplateIndentTemplates(root)
  commentFactory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
  selected := make(map[*shimast.Node]struct{})
  for _, selector := range options.selectors {
    for _, match := range matchASTSelector(root, selector) {
      if isUnicornTemplateIndentLiteral(match) {
        selected[match] = struct{}{}
      }
    }
  }
  ignoredLines := unicornTemplateIndentIgnoredLines(source, templates)

  for _, template := range templates {
    if !unicornTemplateIndentShouldCheck(ctx.File, commentFactory, source, template, options, selected) {
      continue
    }
    edits, changed := unicornTemplateIndentEdits(source, template, options, ignoredLines)
    if !changed {
      continue
    }
    ctx.ReportFix(template, unicornTemplateIndentMessage, edits...)
  }
}

func compileUnicornTemplateIndentOptions(raw json.RawMessage) (unicornTemplateIndentOptions, error) {
  options := unicornTemplateIndentOptions{
    tags:      append([]string(nil), unicornTemplateIndentDefaultTags...),
    functions: append([]string(nil), unicornTemplateIndentDefaultFunctions...),
    comments:  append([]string(nil), unicornTemplateIndentDefaultComments...),
  }
  raw = bytes.TrimSpace(raw)
  if len(raw) == 0 {
    for index := range options.comments {
      options.comments[index] = strings.ToLower(options.comments[index])
    }
    return options, nil
  }
  if raw[0] != '{' {
    return unicornTemplateIndentOptions{}, fmt.Errorf("unicorn/template-indent options must be an object")
  }

  encoded := unicornTemplateIndentRawOptions{}
  if err := decodeStrictJSON(raw, &encoded); err != nil {
    return unicornTemplateIndentOptions{}, fmt.Errorf("unicorn/template-indent options must contain only indent, tags, functions, selectors, and comments: %w", err)
  }

  if len(encoded.Indent) > 0 {
    indent, err := decodeUnicornTemplateIndentIndent(encoded.Indent)
    if err != nil {
      return unicornTemplateIndentOptions{}, err
    }
    options.indent = indent
    options.indentSet = true
  }

  arrays := []struct {
    name     string
    raw      json.RawMessage
    defaults []string
    target   *[]string
  }{
    {name: "tags", raw: encoded.Tags, defaults: options.tags, target: &options.tags},
    {name: "functions", raw: encoded.Functions, defaults: options.functions, target: &options.functions},
    {name: "selectors", raw: encoded.Selectors, target: nil},
    {name: "comments", raw: encoded.Comments, defaults: options.comments, target: &options.comments},
  }
  var selectorSources []string
  for _, entry := range arrays {
    values, err := decodeUnicornTemplateIndentStrings(entry.name, entry.raw, entry.defaults)
    if err != nil {
      return unicornTemplateIndentOptions{}, err
    }
    if entry.name == "selectors" {
      selectorSources = values
      continue
    }
    *entry.target = values
  }

  options.selectors = make([]*astSelector, 0, len(selectorSources))
  for index, source := range selectorSources {
    selector, err := parseASTSelector(source)
    if err != nil {
      return unicornTemplateIndentOptions{}, fmt.Errorf("unicorn/template-indent selector %d %q is invalid: %w", index+1, source, err)
    }
    options.selectors = append(options.selectors, selector)
  }
  for index := range options.comments {
    options.comments[index] = strings.ToLower(options.comments[index])
  }
  return options, nil
}

func decodeUnicornTemplateIndentIndent(raw json.RawMessage) (string, error) {
  raw = bytes.TrimSpace(raw)
  if len(raw) == 0 {
    return "", fmt.Errorf("unicorn/template-indent indent must be a positive integer or non-empty whitespace string")
  }
  if raw[0] == '"' {
    var indent string
    if err := decodeStrictJSON(raw, &indent); err != nil {
      return "", fmt.Errorf("unicorn/template-indent indent must be a string: %w", err)
    }
    if indent == "" {
      return "", fmt.Errorf("unicorn/template-indent indent string must not be empty")
    }
    for _, character := range indent {
      if !unicornTemplateIndentIsECMAScriptWhitespace(character) {
        return "", fmt.Errorf("unicorn/template-indent indent string must contain only whitespace")
      }
    }
    return indent, nil
  }

  var count json.Number
  if err := decodeStrictJSON(raw, &count); err != nil {
    return "", fmt.Errorf("unicorn/template-indent indent must be a positive integer or non-empty whitespace string: %w", err)
  }
  value, err := count.Int64()
  if err != nil || value < 1 || uint64(value) > uint64(^uint(0)>>1) {
    return "", fmt.Errorf("unicorn/template-indent indent number must be a positive integer")
  }
  return strings.Repeat(" ", int(value)), nil
}

func decodeUnicornTemplateIndentStrings(name string, raw json.RawMessage, defaults []string) ([]string, error) {
  raw = bytes.TrimSpace(raw)
  if len(raw) == 0 {
    return append([]string(nil), defaults...), nil
  }
  if raw[0] != '[' {
    return nil, fmt.Errorf("unicorn/template-indent %s must be an array of unique strings", name)
  }
  var values []string
  if err := decodeStrictJSON(raw, &values); err != nil {
    return nil, fmt.Errorf("unicorn/template-indent %s must be an array of unique strings: %w", name, err)
  }
  seen := make(map[string]struct{}, len(values))
  for _, value := range values {
    if _, duplicate := seen[value]; duplicate {
      return nil, fmt.Errorf("unicorn/template-indent %s must not contain duplicate %q", name, value)
    }
    seen[value] = struct{}{}
  }
  return values, nil
}

func collectUnicornTemplateIndentTemplates(root *shimast.Node) []*shimast.Node {
  templates := make([]*shimast.Node, 0)
  walkDescendants(root, func(node *shimast.Node) {
    if isUnicornTemplateIndentLiteral(node) {
      templates = append(templates, node)
    }
  })
  return templates
}

func isUnicornTemplateIndentLiteral(node *shimast.Node) bool {
  return node != nil && (node.Kind == shimast.KindNoSubstitutionTemplateLiteral || node.Kind == shimast.KindTemplateExpression)
}

func unicornTemplateIndentShouldCheck(
  file *shimast.SourceFile,
  commentFactory *shimast.NodeFactory,
  source string,
  template *shimast.Node,
  options unicornTemplateIndentOptions,
  selected map[*shimast.Node]struct{},
) bool {
  if _, ok := selected[template]; ok {
    return true
  }
  start := shimscanner.SkipTrivia(source, template.Pos())
  if unicornTemplateIndentCommentMatches(commentFactory, source, template.Pos(), start, options.comments) {
    return true
  }
  if unicornTemplateIndentIsJestInlineSnapshot(template) {
    return true
  }

  argument := unicornTemplateIndentOuterParenthesizedExpression(template)
  parent := argument.Parent
  if parent == nil {
    return false
  }
  if parent.Kind == shimast.KindTaggedTemplateExpression {
    tagged := parent.AsTaggedTemplateExpression()
    return tagged != nil && tagged.Template == template &&
      unicornTemplateIndentMatchesName(file, tagged.Tag, options.tags)
  }
  if parent.Kind != shimast.KindCallExpression {
    return false
  }
  call := parent.AsCallExpression()
  if call == nil || call.Arguments == nil || !unicornTemplateIndentContainsNode(call.Arguments.Nodes, argument) {
    return false
  }
  return unicornTemplateIndentMatchesName(file, call.Expression, options.functions)
}

func unicornTemplateIndentMatchesName(file *shimast.SourceFile, node *shimast.Node, names []string) bool {
  path := unicornTemplateIndentNamePath(file, node)
  if path == "" {
    return false
  }
  for _, name := range names {
    if path == unicornTemplateIndentTrim(name) {
      return true
    }
  }
  return false
}

func unicornTemplateIndentNamePath(file *shimast.SourceFile, node *shimast.Node) string {
  node = stripParens(node)
  if node == nil {
    return ""
  }
  switch node.Kind {
  case shimast.KindIdentifier:
    return identifierText(node)
  case shimast.KindThisKeyword:
    return "this"
  case shimast.KindSuperKeyword:
    return "super"
  case shimast.KindMetaProperty:
    text := nodeText(file, node)
    if text == "import.meta" || text == "new.target" {
      return text
    }
  case shimast.KindPropertyAccessExpression:
    access := node.AsPropertyAccessExpression()
    if access == nil || access.QuestionDotToken != nil || access.Name() == nil || access.Name().Kind != shimast.KindIdentifier {
      return ""
    }
    object := unicornTemplateIndentNamePath(file, access.Expression)
    if object == "" {
      return ""
    }
    return object + "." + identifierText(access.Name())
  }
  return ""
}

func unicornTemplateIndentContainsNode(nodes []*shimast.Node, target *shimast.Node) bool {
  for _, node := range nodes {
    if node == target {
      return true
    }
  }
  return false
}

func unicornTemplateIndentIsJestInlineSnapshot(template *shimast.Node) bool {
  template = unicornTemplateIndentOuterParenthesizedExpression(template)
  if template == nil || template.Parent == nil || template.Parent.Kind != shimast.KindCallExpression {
    return false
  }
  snapshotCall := template.Parent.AsCallExpression()
  if snapshotCall == nil || snapshotCall.QuestionDotToken != nil || snapshotCall.Arguments == nil ||
    len(snapshotCall.Arguments.Nodes) != 1 || snapshotCall.Arguments.Nodes[0] != template {
    return false
  }
  if snapshotCall.Expression == nil {
    return false
  }
  memberNode := stripParens(snapshotCall.Expression)
  if memberNode == nil || memberNode.Kind != shimast.KindPropertyAccessExpression {
    return false
  }
  member := memberNode.AsPropertyAccessExpression()
  if member == nil || member.QuestionDotToken != nil || identifierText(member.Name()) != "toMatchInlineSnapshot" {
    return false
  }
  if member.Expression == nil {
    return false
  }
  expectNode := stripParens(member.Expression)
  if expectNode == nil || expectNode.Kind != shimast.KindCallExpression {
    return false
  }
  expectCall := expectNode.AsCallExpression()
  return expectCall != nil && expectCall.QuestionDotToken == nil && expectCall.Arguments != nil &&
    len(expectCall.Arguments.Nodes) == 1 && identifierText(stripParens(expectCall.Expression)) == "expect"
}

func unicornTemplateIndentOuterParenthesizedExpression(node *shimast.Node) *shimast.Node {
  for node != nil && node.Parent != nil && node.Parent.Kind == shimast.KindParenthesizedExpression {
    parenthesized := node.Parent.AsParenthesizedExpression()
    if parenthesized == nil || parenthesized.Expression != node {
      break
    }
    node = node.Parent
  }
  return node
}

func unicornTemplateIndentCommentMatches(
  factory *shimast.NodeFactory,
  source string,
  triviaStart int,
  tokenStart int,
  comments []string,
) bool {
  if factory == nil || len(comments) == 0 || triviaStart < 0 ||
    tokenStart <= triviaStart || tokenStart > len(source) {
    return false
  }

  var previous shimast.CommentRange
  found := false
  consider := func(comment shimast.CommentRange) {
    if comment.Pos() < triviaStart || comment.End() > tokenStart {
      return
    }
    if !found || comment.End() > previous.End() {
      previous = comment
      found = true
    }
  }
  for comment := range shimscanner.GetTrailingCommentRanges(factory, source, triviaStart) {
    consider(comment)
  }
  for comment := range shimscanner.GetLeadingCommentRanges(factory, source, triviaStart) {
    consider(comment)
  }
  if !found || previous.Kind != shimast.KindMultiLineCommentTrivia ||
    previous.Pos()+4 > previous.End() || previous.End() > len(source) {
    return false
  }
  value := strings.ToLower(unicornTemplateIndentTrim(source[previous.Pos()+2 : previous.End()-2]))
  for _, comment := range comments {
    if value == comment {
      return true
    }
  }
  return false
}

func unicornTemplateIndentEdits(
  source string,
  template *shimast.Node,
  options unicornTemplateIndentOptions,
  ignoredLines map[int]struct{},
) ([]TextEdit, bool) {
  quasis, ok := unicornTemplateIndentQuasis(source, template)
  if !ok || len(quasis) == 0 {
    return nil, false
  }
  marker := unicornTemplateIndentMarker(quasis)
  var joinedBuilder strings.Builder
  for index, quasi := range quasis {
    if index > 0 {
      joinedBuilder.WriteString(marker)
    }
    joinedBuilder.WriteString(quasi.text)
  }
  joined := joinedBuilder.String()
  eol := unicornTemplateIndentFirstEOL(joined)
  if eol == "" {
    return nil, false
  }

  templateStart := shimscanner.SkipTrivia(source, template.Pos())
  parentMargin := unicornTemplateIndentParentMargin(source, templateStart)
  indent := options.indent
  if !options.indentSet {
    if parentMargin == "" {
      indent = unicornTemplateIndentDetect(
        unicornTemplateIndentSourceForDetection(source, ignoredLines),
      )
      if indent == "" {
        templateText := unicornTemplateIndentTextForDetection(joined)
        indent = unicornTemplateIndentDetect(unicornTemplateIndentStrip(templateText))
        if indent == "" {
          indent = unicornTemplateIndentDetect(templateText)
        }
      }
      if indent == "" {
        indent = "  "
      }
    } else if parentMargin[0] == '\t' {
      indent = "\t"
    } else {
      indent = "  "
    }
  }

  fixed := unicornTemplateIndentStrip(joined)
  if strings.HasPrefix(fixed, eol) {
    fixed = fixed[len(eol):]
  }
  if boundary := strings.LastIndex(fixed, eol); boundary >= 0 &&
    unicornTemplateIndentOnlyHorizontalSpace(fixed[boundary+len(eol):]) {
    fixed = fixed[:boundary]
  }
  fixed = unicornTemplateIndentIndentNonEmpty(fixed, parentMargin+indent)
  fixed = eol + fixed + eol + parentMargin
  if fixed == joined {
    return nil, false
  }

  replacements := strings.Split(fixed, marker)
  if len(replacements) != len(quasis) {
    return nil, false
  }
  edits := make([]TextEdit, 0, len(quasis))
  for index, quasi := range quasis {
    if replacements[index] == quasi.text {
      continue
    }
    edits = append(edits, TextEdit{Pos: quasi.pos, End: quasi.end, Text: replacements[index]})
  }
  return edits, len(edits) > 0
}

func unicornTemplateIndentQuasis(source string, template *shimast.Node) ([]unicornTemplateIndentQuasi, bool) {
  if template == nil {
    return nil, false
  }
  switch template.Kind {
  case shimast.KindNoSubstitutionTemplateLiteral:
    start := shimscanner.SkipTrivia(source, template.Pos())
    end := template.End()
    if start < 0 || end > len(source) || start+2 > end || source[start] != '`' || source[end-1] != '`' {
      return nil, false
    }
    return []unicornTemplateIndentQuasi{{pos: start + 1, end: end - 1, text: source[start+1 : end-1]}}, true
  case shimast.KindTemplateExpression:
    expression := template.AsTemplateExpression()
    if expression == nil || expression.Head == nil || expression.TemplateSpans == nil {
      return nil, false
    }
    headStart := shimscanner.SkipTrivia(source, expression.Head.Pos())
    headEnd := expression.Head.End()
    if headStart < 0 || headEnd > len(source) || headStart+3 > headEnd || source[headStart] != '`' || source[headEnd-2:headEnd] != "${" {
      return nil, false
    }
    quasis := []unicornTemplateIndentQuasi{{
      pos: headStart + 1,
      end: headEnd - 2,
      text: source[headStart+1 : headEnd-2],
    }}
    for _, spanNode := range expression.TemplateSpans.Nodes {
      span := spanNode.AsTemplateSpan()
      if span == nil || span.Literal == nil {
        return nil, false
      }
      literal := span.Literal
      start := shimscanner.SkipTrivia(source, literal.Pos())
      end := literal.End()
      if start < 0 || end > len(source) || start+2 > end || source[start] != '}' {
        return nil, false
      }
      suffix := 1
      if literal.Kind == shimast.KindTemplateMiddle {
        suffix = 2
        if start+3 > end || source[end-2:end] != "${" {
          return nil, false
        }
      } else if literal.Kind != shimast.KindTemplateTail || source[end-1] != '`' {
        return nil, false
      }
      quasis = append(quasis, unicornTemplateIndentQuasi{
        pos: start + 1,
        end: end - suffix,
        text: source[start+1 : end-suffix],
      })
    }
    return quasis, true
  }
  return nil, false
}

func unicornTemplateIndentMarker(quasis []unicornTemplateIndentQuasi) string {
  for index := 0; ; index++ {
    marker := fmt.Sprintf("\x00TTSC_TEMPLATE_INDENT_%d\x00", index)
    available := true
    for _, quasi := range quasis {
      if strings.Contains(quasi.text, marker) {
        available = false
        break
      }
    }
    if available {
      return marker
    }
  }
}

func unicornTemplateIndentFirstEOL(text string) string {
  newline := strings.IndexByte(text, '\n')
  if newline < 0 {
    return ""
  }
  if newline > 0 && text[newline-1] == '\r' {
    return "\r\n"
  }
  return "\n"
}

func unicornTemplateIndentParentMargin(source string, pos int) string {
  if pos < 0 || pos > len(source) {
    return ""
  }
  lineStart := 0
  for index := 0; index < pos; {
    if width := unicornTemplateIndentLineBreakWidth(source, index); width > 0 {
      lineStart = index + width
      index += width
      continue
    }
    _, width := utf8.DecodeRuneInString(source[index:])
    index += width
  }
  lineEnd := len(source)
  for index := pos; index < len(source); {
    if width := unicornTemplateIndentLineBreakWidth(source, index); width > 0 {
      lineEnd = index
      break
    }
    _, width := utf8.DecodeRuneInString(source[index:])
    index += width
  }
  line := source[lineStart:lineEnd]
  index := 0
  if lineStart == 0 && strings.HasPrefix(line, "\uFEFF") {
    index = len("\uFEFF")
  }
  marginStart := index
  for index < len(line) {
    character, size := utf8.DecodeRuneInString(line[index:])
    if !unicornTemplateIndentIsECMAScriptWhitespace(character) {
      break
    }
    index += size
  }
  if index == len(line) {
    return ""
  }
  return line[marginStart:index]
}

func unicornTemplateIndentStrip(text string) string {
  lines := unicornTemplateIndentSplitLines(text)
  minimum := -1
  for _, line := range lines {
    indent := 0
    for indent < len(line.text) && (line.text[indent] == ' ' || line.text[indent] == '\t') {
      indent++
    }
    if unicornTemplateIndentWhitespaceOnly(line.text[indent:]) {
      continue
    }
    if minimum < 0 || indent < minimum {
      minimum = indent
    }
  }
  if minimum <= 0 {
    return text
  }
  for index := range lines {
    removable := 0
    for removable < len(lines[index].text) && removable < minimum &&
      (lines[index].text[removable] == ' ' || lines[index].text[removable] == '\t') {
      removable++
    }
    if removable == minimum {
      lines[index].text = lines[index].text[minimum:]
    }
  }
  return unicornTemplateIndentJoinLines(lines)
}

func unicornTemplateIndentIndentNonEmpty(text, indent string) string {
  lines := unicornTemplateIndentSplitLines(text)
  for index := range lines {
    if !unicornTemplateIndentWhitespaceOnly(lines[index].text) {
      lines[index].text = indent + lines[index].text
    }
  }
  return unicornTemplateIndentJoinLines(lines)
}

func unicornTemplateIndentSplitLines(text string) []unicornTemplateIndentLine {
  lines := make([]unicornTemplateIndentLine, 0, strings.Count(text, "\n")+1)
  start := 0
  for index := 0; index < len(text); {
    if width := unicornTemplateIndentLineBreakWidth(text, index); width > 0 {
      lines = append(lines, unicornTemplateIndentLine{
        text:       text[start:index],
        terminator: text[index : index+width],
      })
      index += width
      start = index
      continue
    }
    _, width := utf8.DecodeRuneInString(text[index:])
    index += width
  }
  return append(lines, unicornTemplateIndentLine{text: text[start:]})
}

func unicornTemplateIndentJoinLines(lines []unicornTemplateIndentLine) string {
  var joined strings.Builder
  for _, line := range lines {
    joined.WriteString(line.text)
    joined.WriteString(line.terminator)
  }
  return joined.String()
}

func unicornTemplateIndentOnlyHorizontalSpace(text string) bool {
  for index := 0; index < len(text); index++ {
    if text[index] != ' ' && text[index] != '\t' {
      return false
    }
  }
  return true
}

func unicornTemplateIndentIgnoredLines(source string, templates []*shimast.Node) map[int]struct{} {
  starts := unicornTemplateIndentSourceLineStarts(source)
  ignored := make(map[int]struct{})
  for _, template := range templates {
    start := shimscanner.SkipTrivia(source, template.Pos())
    end := template.End()
    if start < 0 || start >= len(source) || end <= start {
      continue
    }
    if end > len(source) {
      end = len(source)
    }
    startLine := unicornTemplateIndentLineAt(starts, start)
    endLine := unicornTemplateIndentLineAt(starts, end-1)
    for line := startLine + 1; line <= endLine; line++ {
      ignored[line] = struct{}{}
    }
  }
  return ignored
}

func unicornTemplateIndentSourceLineStarts(source string) []int {
  starts := []int{0}
  for index := 0; index < len(source); {
    if width := unicornTemplateIndentLineBreakWidth(source, index); width > 0 {
      index += width
      starts = append(starts, index)
      continue
    }
    _, width := utf8.DecodeRuneInString(source[index:])
    index += width
  }
  return starts
}

func unicornTemplateIndentLineBreakWidth(source string, index int) int {
  if index < 0 || index >= len(source) {
    return 0
  }
  switch source[index] {
  case '\r':
    if index+1 < len(source) && source[index+1] == '\n' {
      return 2
    }
    return 1
  case '\n':
    return 1
  }
  character, width := utf8.DecodeRuneInString(source[index:])
  if character == '\u2028' || character == '\u2029' {
    return width
  }
  return 0
}

func unicornTemplateIndentLineAt(starts []int, pos int) int {
  index := sort.Search(len(starts), func(index int) bool { return starts[index] > pos })
  if index == 0 {
    return 0
  }
  return index - 1
}

func unicornTemplateIndentSourceForDetection(source string, ignored map[int]struct{}) string {
  var normalized strings.Builder
  normalized.Grow(len(source))
  index := 0
  if strings.HasPrefix(source, "\uFEFF") {
    index = len("\uFEFF")
  }
  for index < len(source) {
    if width := unicornTemplateIndentLineBreakWidth(source, index); width > 0 {
      normalized.WriteByte('\n')
      index += width
      continue
    }
    _, width := utf8.DecodeRuneInString(source[index:])
    normalized.WriteString(source[index : index+width])
    index += width
  }
  return unicornTemplateIndentLinesForDetection(normalized.String(), ignored)
}

func unicornTemplateIndentTextForDetection(text string) string {
  return unicornTemplateIndentLinesForDetection(strings.ReplaceAll(text, "\r\n", "\n"), nil)
}

func unicornTemplateIndentLinesForDetection(text string, ignored map[int]struct{}) string {
  lines := strings.Split(text, "\n")
  for index, line := range lines {
    if _, skip := ignored[index]; skip || unicornTemplateIndentWhitespaceOnly(line) {
      lines[index] = ""
    }
  }
  return strings.Join(lines, "\n")
}

func unicornTemplateIndentWhitespaceOnly(text string) bool {
  for _, character := range text {
    if !unicornTemplateIndentIsECMAScriptWhitespace(character) {
      return false
    }
  }
  return true
}

func unicornTemplateIndentTrim(text string) string {
  return strings.TrimFunc(text, unicornTemplateIndentIsECMAScriptWhitespace)
}

func unicornTemplateIndentIsECMAScriptWhitespace(character rune) bool {
  if unicode.In(character, unicode.Zs) {
    return true
  }
  switch character {
  case '\t', '\v', '\f', '\n', '\r', '\u2028', '\u2029', '\uFEFF':
    return true
  default:
    return false
  }
}

func unicornTemplateIndentDetect(text string) string {
  stats := unicornTemplateIndentStats(text, true)
  if len(stats) == 0 {
    stats = unicornTemplateIndentStats(text, false)
  }
  if len(stats) == 0 {
    return ""
  }
  best := stats[0]
  for _, stat := range stats[1:] {
    if stat.uses > best.uses || stat.uses == best.uses && stat.weight > best.weight {
      best = stat
    }
  }
  character := " "
  if best.kind == 't' {
    character = "\t"
  }
  return strings.Repeat(character, best.amount)
}

func unicornTemplateIndentStats(text string, ignoreSingleSpaces bool) []unicornTemplateIndentStat {
  stats := make([]unicornTemplateIndentStat, 0)
  indexes := make(map[[2]int]int)
  previousSize := 0
  var previousKind byte
  current := -1

  for _, line := range strings.Split(text, "\n") {
    if line == "" {
      continue
    }
    kind, size := unicornTemplateIndentLeadingRun(line)
    if size == 0 {
      previousSize = 0
      previousKind = 0
      current = -1
      continue
    }
    if ignoreSingleSpaces && kind == 's' && size == 1 {
      continue
    }
    if kind != previousKind {
      previousSize = 0
    }
    previousKind = kind
    difference := size - previousSize
    previousSize = size
    if difference == 0 {
      if current >= 0 {
        stats[current].weight++
      }
      continue
    }
    if difference < 0 {
      difference = -difference
    }
    if ignoreSingleSpaces && kind == 's' && difference == 1 {
      continue
    }
    key := [2]int{int(kind), difference}
    if index, exists := indexes[key]; exists {
      current = index
      stats[index].uses++
      continue
    }
    current = len(stats)
    indexes[key] = current
    stats = append(stats, unicornTemplateIndentStat{kind: kind, amount: difference, uses: 1})
  }
  return stats
}

func unicornTemplateIndentLeadingRun(line string) (byte, int) {
  if line == "" {
    return 0, 0
  }
  character := line[0]
  if character != ' ' && character != '\t' {
    return 0, 0
  }
  end := 1
  for end < len(line) && line[end] == character {
    end++
  }
  if character == '\t' {
    return 't', end
  }
  return 's', end
}

func init() {
  Register(unicornTemplateIndent{})
}
