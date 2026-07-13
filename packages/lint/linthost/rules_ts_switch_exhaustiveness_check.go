// typescript/switch-exhaustiveness-check: require switches over finite
// discriminants to cover every enumerable member. The implementation mirrors
// typescript-eslint's scalar defaults and option interactions while using the
// TypeScript-Go Checker as the type oracle.
//
// Reference:
// https://typescript-eslint.io/rules/switch-exhaustiveness-check/
package linthost

import (
  "regexp"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

type switchExhaustivenessCheck struct{}

type switchExhaustivenessCheckOptions struct {
  AllowDefaultCaseForExhaustiveSwitch *bool   `json:"allowDefaultCaseForExhaustiveSwitch"`
  ConsiderDefaultExhaustiveForUnions  *bool   `json:"considerDefaultExhaustiveForUnions"`
  DefaultCaseCommentPattern           *string `json:"defaultCaseCommentPattern"`
  RequireDefaultForNonUnion           *bool   `json:"requireDefaultForNonUnion"`
}

type resolvedSwitchExhaustivenessCheckOptions struct {
  allowDefaultCaseForExhaustiveSwitch bool
  considerDefaultExhaustiveForUnions  bool
  defaultCaseCommentPattern           *regexp.Regexp
  requireDefaultForNonUnion           bool
}

type switchExhaustivenessCheckDefaultCase struct {
  node *shimast.Node
  pos  int
  end  int
}

type switchExhaustivenessCheckMetadata struct {
  containsNonLiteralType bool
  defaultCase            *switchExhaustivenessCheckDefaultCase
  caseBlock              *shimast.Node
  lastClause             *shimast.Node
  missingMembers         []*shimchecker.Type
}

var switchExhaustivenessCheckDefaultCommentPattern = regexp.MustCompile(`(?i)^no default$`)

func (switchExhaustivenessCheck) Name() string { return "typescript/switch-exhaustiveness-check" }
func (switchExhaustivenessCheck) NeedsTypeChecker() bool {
  return true
}
func (switchExhaustivenessCheck) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSwitchStatement}
}
func (switchExhaustivenessCheck) Check(ctx *Context, node *shimast.Node) {
  if ctx.Checker == nil {
    return
  }

  var rawOptions switchExhaustivenessCheckOptions
  if err := ctx.DecodeOptions(&rawOptions); err != nil {
    return
  }
  options := resolveSwitchExhaustivenessCheckOptions(rawOptions)
  metadata := switchExhaustivenessCheckCollectMetadata(
    ctx,
    node,
    options.defaultCaseCommentPattern,
  )
  if metadata == nil {
    return
  }

  sw := node.AsSwitchStatement()
  if sw == nil || sw.Expression == nil {
    return
  }

  if !(options.considerDefaultExhaustiveForUnions && metadata.defaultCase != nil) &&
    len(metadata.missingMembers) > 0 {
    missing := make([]string, 0, len(metadata.missingMembers))
    for _, member := range metadata.missingMembers {
      missing = append(missing, switchExhaustivenessCheckTypeName(ctx.Checker, sw.Expression, member))
    }
    message := "Switch is not exhaustive. Cases not matched: " + strings.Join(missing, " | ")
    if edit, ok := switchExhaustivenessCheckSuggestion(
      ctx,
      node,
      metadata,
      metadata.missingMembers,
      false,
    ); ok {
      ctx.ReportSuggestion(sw.Expression, message, "Add branches for missing cases.", edit)
    } else {
      ctx.Report(sw.Expression, message)
    }
  }

  if !options.allowDefaultCaseForExhaustiveSwitch &&
    len(metadata.missingMembers) == 0 &&
    metadata.defaultCase != nil &&
    !metadata.containsNonLiteralType {
    switchExhaustivenessCheckReportDefaultCase(
      ctx,
      metadata.defaultCase,
      "The switch statement is exhaustive, so the default case is unnecessary.",
    )
  }

  if options.requireDefaultForNonUnion &&
    metadata.containsNonLiteralType &&
    metadata.defaultCase == nil {
    const message = "Switch is not exhaustive. Cases not matched: default"
    if edit, ok := switchExhaustivenessCheckSuggestion(
      ctx,
      node,
      metadata,
      nil,
      true,
    ); ok {
      ctx.ReportSuggestion(sw.Expression, message, "Add a default branch.", edit)
    } else {
      ctx.Report(sw.Expression, message)
    }
  }
}

func resolveSwitchExhaustivenessCheckOptions(
  raw switchExhaustivenessCheckOptions,
) resolvedSwitchExhaustivenessCheckOptions {
  resolved := resolvedSwitchExhaustivenessCheckOptions{
    allowDefaultCaseForExhaustiveSwitch: true,
    defaultCaseCommentPattern:           switchExhaustivenessCheckDefaultCommentPattern,
  }
  if raw.AllowDefaultCaseForExhaustiveSwitch != nil {
    resolved.allowDefaultCaseForExhaustiveSwitch = *raw.AllowDefaultCaseForExhaustiveSwitch
  }
  if raw.ConsiderDefaultExhaustiveForUnions != nil {
    resolved.considerDefaultExhaustiveForUnions = *raw.ConsiderDefaultExhaustiveForUnions
  }
  if raw.RequireDefaultForNonUnion != nil {
    resolved.requireDefaultForNonUnion = *raw.RequireDefaultForNonUnion
  }
  if raw.DefaultCaseCommentPattern != nil {
    pattern, err := regexp.Compile(*raw.DefaultCaseCommentPattern)
    if err != nil {
      resolved.defaultCaseCommentPattern = nil
    } else {
      resolved.defaultCaseCommentPattern = pattern
    }
  }
  return resolved
}

// switchExhaustivenessCheckCollectMetadata resolves the discriminant and case
// expressions through their base constraints, then computes missing literal
// branches before applying any policy option. Open primitive constituents are
// recorded independently, so `string | undefined` keeps `undefined` enumerable
// without pretending the `string` portion can be exhausted.
func switchExhaustivenessCheckCollectMetadata(
  ctx *Context,
  node *shimast.Node,
  commentPattern *regexp.Regexp,
) *switchExhaustivenessCheckMetadata {
  sw := node.AsSwitchStatement()
  if sw == nil || sw.Expression == nil || sw.CaseBlock == nil {
    return nil
  }
  block := sw.CaseBlock.AsCaseBlock()
  if block == nil || block.Clauses == nil {
    return nil
  }

  discriminantType := switchExhaustivenessCheckConstrainedType(
    ctx.Checker,
    ctx.Checker.GetTypeAtLocation(sw.Expression),
  )
  if discriminantType == nil {
    return nil
  }

  caseTypes := make([]*shimchecker.Type, 0, len(block.Clauses.Nodes))
  var defaultCase *switchExhaustivenessCheckDefaultCase
  var lastClause *shimast.Node
  for _, clause := range block.Clauses.Nodes {
    if clause == nil {
      continue
    }
    lastClause = clause
    if clause.Kind == shimast.KindDefaultClause {
      if defaultCase == nil {
        pos, _ := tokenRange(ctx.File, clause)
        defaultCase = &switchExhaustivenessCheckDefaultCase{node: clause, pos: pos}
      }
      continue
    }
    if clause.Kind != shimast.KindCaseClause {
      continue
    }
    caseClause := clause.AsCaseOrDefaultClause()
    if caseClause == nil || caseClause.Expression == nil {
      continue
    }
    caseType := switchExhaustivenessCheckConstrainedType(
      ctx.Checker,
      ctx.Checker.GetTypeAtLocation(caseClause.Expression),
    )
    if caseType != nil {
      caseTypes = append(caseTypes, caseType)
    }
  }
  if defaultCase == nil {
    defaultCase = switchExhaustivenessCheckCommentDefaultCase(
      ctx,
      sw.CaseBlock,
      lastClause,
      commentPattern,
    )
  }

  members, containsNonLiteralType := switchExhaustivenessCheckTypeParts(ctx.Checker, discriminantType)
  missing := make([]*shimchecker.Type, 0, len(members))
  for _, member := range members {
    if !switchExhaustivenessCheckCaseTypesCover(caseTypes, member) {
      missing = append(missing, member)
    }
  }
  return &switchExhaustivenessCheckMetadata{
    containsNonLiteralType: containsNonLiteralType,
    defaultCase:            defaultCase,
    caseBlock:              sw.CaseBlock,
    lastClause:             lastClause,
    missingMembers:         missing,
  }
}

func switchExhaustivenessCheckConstrainedType(
  checker *shimchecker.Checker,
  t *shimchecker.Type,
) *shimchecker.Type {
  if checker == nil || t == nil {
    return t
  }
  if constraint := checker.GetBaseConstraintOfType(t); constraint != nil {
    t = constraint
  }
  return shimchecker.Checker_getRegularTypeOfLiteralType(checker, t)
}

// switchExhaustivenessCheckTypeParts mirrors typescript-eslint's nested
// unionConstituents/intersectionConstituents walk. Literal-like intersection
// pieces remain enumerable even when another piece is open-ended. A union part
// is considered non-literal only when every one of its intersection pieces is
// non-literal.
func switchExhaustivenessCheckTypeParts(
  checker *shimchecker.Checker,
  t *shimchecker.Type,
) ([]*shimchecker.Type, bool) {
  if t == nil {
    return nil, false
  }
  unionParts := []*shimchecker.Type{t}
  if t.Flags()&shimchecker.TypeFlagsUnion != 0 {
    unionParts = t.Types()
  }

  members := make([]*shimchecker.Type, 0, len(unionParts))
  seen := make(map[*shimchecker.Type]struct{}, len(unionParts))
  containsNonLiteralType := false
  for _, unionPart := range unionParts {
    if unionPart == nil {
      continue
    }
    intersectionParts := []*shimchecker.Type{unionPart}
    if unionPart.Flags()&shimchecker.TypeFlagsIntersection != 0 {
      intersectionParts = unionPart.Types()
    }
    partContainsLiteral := false
    for _, intersectionPart := range intersectionParts {
      intersectionPart = shimchecker.Checker_getRegularTypeOfLiteralType(checker, intersectionPart)
      if !switchExhaustivenessCheckIsLiteralLike(intersectionPart) {
        continue
      }
      partContainsLiteral = true
      if switchExhaustivenessCheckContainsEquivalentMember(members, intersectionPart) {
        continue
      }
      if _, ok := seen[intersectionPart]; ok {
        continue
      }
      seen[intersectionPart] = struct{}{}
      members = append(members, intersectionPart)
    }
    if !partContainsLiteral {
      containsNonLiteralType = true
    }
  }
  return members, containsNonLiteralType
}

func switchExhaustivenessCheckContainsEquivalentMember(
  members []*shimchecker.Type,
  candidate *shimchecker.Type,
) bool {
  if candidate == nil || candidate.Flags()&shimchecker.TypeFlagsUndefined == 0 {
    return false
  }
  for _, member := range members {
    if member != nil && member.Flags()&shimchecker.TypeFlagsUndefined != 0 {
      return true
    }
  }
  return false
}

func switchExhaustivenessCheckCaseTypesCover(
  caseTypes []*shimchecker.Type,
  member *shimchecker.Type,
) bool {
  if member == nil {
    return false
  }
  for _, caseType := range caseTypes {
    if caseType == member {
      return true
    }
    // TypeScript represents `undefined`, optional, and no-unchecked-indexed-
    // access missing types with distinct pointers. They all carry the
    // Undefined flag and denote the same runtime switch value.
    if caseType != nil &&
      caseType.Flags()&shimchecker.TypeFlagsUndefined != 0 &&
      member.Flags()&shimchecker.TypeFlagsUndefined != 0 {
      return true
    }
  }
  return false
}

func switchExhaustivenessCheckIsLiteralLike(t *shimchecker.Type) bool {
  if t == nil {
    return false
  }
  return t.Flags()&(shimchecker.TypeFlagsLiteral|
    shimchecker.TypeFlagsUndefined|
    shimchecker.TypeFlagsNull|
    shimchecker.TypeFlagsUniqueESSymbol) != 0
}

func switchExhaustivenessCheckTypeName(
  checker *shimchecker.Checker,
  location *shimast.Node,
  t *shimchecker.Type,
) string {
  if t == nil {
    return "unknown"
  }
  if t.Flags()&shimchecker.TypeFlagsESSymbolLike != 0 {
    if symbol := t.Symbol(); symbol != nil {
      if name := shimchecker.Checker_symbolToValueString(checker, symbol, location); name != "" {
        return "typeof " + name
      }
      if symbol.Name != "" {
        return "typeof " + symbol.Name
      }
    }
  }
  if name := shimchecker.Checker_typeToStringFullyQualified(checker, t, location); name != "" {
    return name
  }
  return checker.TypeToString(t)
}

func switchExhaustivenessCheckSuggestion(
  ctx *Context,
  switchNode *shimast.Node,
  metadata *switchExhaustivenessCheckMetadata,
  members []*shimchecker.Type,
  includeDefault bool,
) (TextEdit, bool) {
  if ctx == nil || ctx.File == nil || ctx.Checker == nil ||
    switchNode == nil || metadata == nil {
    return TextEdit{}, false
  }
  sw := switchNode.AsSwitchStatement()
  if sw == nil || sw.Expression == nil {
    return TextEdit{}, false
  }
  branches := make([]string, 0, len(members)+1)
  for _, member := range members {
    expression, ok := switchExhaustivenessCheckCaseExpression(
      ctx.Checker,
      sw.Expression,
      member,
    )
    if !ok {
      return TextEdit{}, false
    }
    branches = append(
      branches,
      `case `+expression+`: { throw new Error("Not implemented yet"); }`,
    )
  }
  if includeDefault {
    branches = append(branches, `default: { throw new Error("Not implemented yet"); }`)
  }
  if len(branches) == 0 {
    return TextEdit{}, false
  }
  return switchExhaustivenessCheckInsertionEdit(ctx.File, switchNode, metadata, branches)
}

func switchExhaustivenessCheckCaseExpression(
  checker *shimchecker.Checker,
  location *shimast.Node,
  member *shimchecker.Type,
) (string, bool) {
  if checker == nil || location == nil || member == nil {
    return "", false
  }
  if symbol := member.Symbol(); symbol != nil {
    if !shimchecker.Checker_isSymbolAccessibleAsValue(checker, symbol, location) {
      return "", false
    }
    expression := strings.TrimSpace(
      shimchecker.Checker_symbolToValueString(checker, symbol, location),
    )
    return expression, expression != ""
  }
  expression := strings.TrimSpace(
    shimchecker.Checker_typeToStringFullyQualified(checker, member, location),
  )
  return expression, expression != ""
}

func switchExhaustivenessCheckInsertionEdit(
  file *shimast.SourceFile,
  switchNode *shimast.Node,
  metadata *switchExhaustivenessCheckMetadata,
  branches []string,
) (TextEdit, bool) {
  if file == nil || switchNode == nil || metadata == nil || len(branches) == 0 {
    return TextEdit{}, false
  }
  source := file.Text()
  newline := "\n"
  if strings.Contains(source, "\r\n") {
    newline = "\r\n"
  }

  if metadata.defaultCase != nil &&
    metadata.defaultCase.pos >= 0 && metadata.defaultCase.pos <= len(source) {
    pos := metadata.defaultCase.pos
    indent := switchExhaustivenessCheckLineIndent(source, pos)
    text := strings.Join(branches, newline+indent) + newline + indent
    if !switchExhaustivenessCheckLineHasOnlyIndent(source, pos) {
      indent = switchExhaustivenessCheckCaseIndent(source, file, switchNode, metadata)
      text = newline + indent + strings.Join(branches, newline+indent) + newline + indent
    }
    return TextEdit{Pos: pos, End: pos, Text: text}, true
  }

  if metadata.lastClause != nil {
    pos := metadata.lastClause.End()
    if pos < 0 || pos > len(source) {
      return TextEdit{}, false
    }
    clausePos, _ := tokenRange(file, metadata.lastClause)
    indent := switchExhaustivenessCheckLineIndent(source, clausePos)
    text := newline + indent + strings.Join(branches, newline+indent)
    return TextEdit{Pos: pos, End: pos, Text: text}, true
  }

  if metadata.caseBlock == nil ||
    shimscanner.ScanTokenAtPosition(file, metadata.caseBlock.Pos()) != shimast.KindOpenBraceToken {
    return TextEdit{}, false
  }
  openingBrace := shimscanner.GetRangeOfTokenAtPosition(file, metadata.caseBlock.Pos())
  if shimscanner.ScanTokenAtPosition(file, openingBrace.End()) != shimast.KindCloseBraceToken {
    return TextEdit{}, false
  }
  closingBrace := shimscanner.GetRangeOfTokenAtPosition(file, openingBrace.End())
  if openingBrace.End() < 0 || closingBrace.Pos() < openingBrace.End() ||
    closingBrace.Pos() > len(source) {
    return TextEdit{}, false
  }
  switchPos, _ := tokenRange(file, switchNode)
  switchIndent := switchExhaustivenessCheckLineIndent(source, switchPos)
  caseIndent := switchIndent + "  "
  branchText := strings.Join(branches, newline+caseIndent)
  interior := source[openingBrace.End():closingBrace.Pos()]
  if strings.TrimSpace(interior) == "" {
    return TextEdit{
      Pos:  openingBrace.End(),
      End:  closingBrace.Pos(),
      Text: newline + caseIndent + branchText + newline + switchIndent,
    }, true
  }
  return TextEdit{
    Pos:  openingBrace.End(),
    End:  openingBrace.End(),
    Text: newline + caseIndent + branchText + newline + caseIndent,
  }, true
}

func switchExhaustivenessCheckLineIndent(source string, pos int) string {
  if pos < 0 || pos > len(source) {
    return ""
  }
  lineStart := strings.LastIndex(source[:pos], "\n") + 1
  indent := source[lineStart:pos]
  for _, ch := range indent {
    if ch != ' ' && ch != '\t' && ch != '\r' {
      return ""
    }
  }
  return indent
}

func switchExhaustivenessCheckLineHasOnlyIndent(source string, pos int) bool {
  if pos < 0 || pos > len(source) {
    return false
  }
  lineStart := strings.LastIndex(source[:pos], "\n") + 1
  return strings.TrimSpace(source[lineStart:pos]) == ""
}

func switchExhaustivenessCheckCaseIndent(
  source string,
  file *shimast.SourceFile,
  switchNode *shimast.Node,
  metadata *switchExhaustivenessCheckMetadata,
) string {
  if metadata != nil && metadata.lastClause != nil {
    clausePos, _ := tokenRange(file, metadata.lastClause)
    if switchExhaustivenessCheckLineHasOnlyIndent(source, clausePos) {
      return switchExhaustivenessCheckLineIndent(source, clausePos)
    }
  }
  switchPos, _ := tokenRange(file, switchNode)
  return switchExhaustivenessCheckLineIndent(source, switchPos) + "  "
}

// switchExhaustivenessCheckCommentDefaultCase recognizes only the last comment
// after the last real clause and before the case block's closing brace. This is
// the same scope as SourceCode#getCommentsAfter(lastCase); a matching comment
// elsewhere in the switch cannot suppress a diagnostic.
func switchExhaustivenessCheckCommentDefaultCase(
  ctx *Context,
  caseBlock *shimast.Node,
  lastClause *shimast.Node,
  pattern *regexp.Regexp,
) *switchExhaustivenessCheckDefaultCase {
  if ctx.File == nil || caseBlock == nil || lastClause == nil || pattern == nil {
    return nil
  }
  text := ctx.File.Text()
  from := lastClause.End()
  if shimscanner.ScanTokenAtPosition(ctx.File, lastClause.End()) != shimast.KindCloseBraceToken {
    return nil
  }
  closeBrace := shimscanner.GetRangeOfTokenAtPosition(ctx.File, lastClause.End())
  to := closeBrace.Pos()
  if from < 0 || to < from || to > len(text) {
    return nil
  }
  candidateKind := shimast.KindUnknown
  candidatePos := -1
  candidateEnd := -1
  // `from:to` is itself a parser-classified trivia gap: it begins after the
  // last clause and ends before the case block's closing-brace token. Scan the
  // bounded gap directly so a file with many switches does not re-enumerate
  // the whole AST for every switch node.
  scanCommentGap(shimscanner.NewScanner(), text, from, to, func(kind shimast.Kind, pos, end int) {
    candidateKind = kind
    candidatePos = pos
    candidateEnd = end
  })
  if candidatePos < 0 || candidateEnd <= candidatePos {
    return nil
  }
  value := text[candidatePos:candidateEnd]
  switch candidateKind {
  case shimast.KindSingleLineCommentTrivia:
    value = strings.TrimPrefix(value, "//")
  case shimast.KindMultiLineCommentTrivia:
    value = strings.TrimSuffix(strings.TrimPrefix(value, "/*"), "*/")
  }
  if !pattern.MatchString(strings.TrimSpace(value)) {
    return nil
  }
  return &switchExhaustivenessCheckDefaultCase{
    pos: candidatePos,
    end: candidateEnd,
  }
}

func switchExhaustivenessCheckReportDefaultCase(
  ctx *Context,
  defaultCase *switchExhaustivenessCheckDefaultCase,
  message string,
) {
  if defaultCase == nil {
    return
  }
  if defaultCase.node != nil {
    ctx.Report(defaultCase.node, message)
    return
  }
  ctx.ReportRange(defaultCase.pos, defaultCase.end, message)
}

func init() {
  Register(switchExhaustivenessCheck{})
}
