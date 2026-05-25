package linthost

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// onlyExportComponents enforces React Fast Refresh's module boundary rule:
// files that export React components should not also export non-components.
// Ported from eslint-plugin-react-refresh's only-export-components rule.
type onlyExportComponents struct{}

type onlyExportComponentsOptions struct {
  ExtraHOCs           []string `json:"extraHOCs"`
  AllowExportNames    []string `json:"allowExportNames"`
  AllowConstantExport bool     `json:"allowConstantExport"`
  CheckJS             bool     `json:"checkJS"`
}

type reactRefreshScan struct {
  ctx                 *Context
  options             onlyExportComponentsOptions
  allowedExportNames  map[string]bool
  validHOCs           map[string]bool
  requireReactImport  bool
  hasExports          bool
  hasReactExport      bool
  reactIsInScope      bool
  localComponents     []*shimast.Node
  nonComponentExports []*shimast.Node
  reactContextExports []*shimast.Node
}

type reactComponentExpressionResult int

const (
  reactComponentExpressionNo reactComponentExpressionResult = iota
  reactComponentExpressionYes
  reactComponentExpressionNeedName
)

const (
  reactRefreshNamedExportMessage = "Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components."
  reactRefreshAnonymousMessage   = "Fast refresh can't handle anonymous components. Add a name to your export."
  reactRefreshLocalMessage       = "Fast refresh only works when a file only exports components. Move your component(s) to a separate file. If all exports are HOCs, add them to the extraHOCs option."
  reactRefreshNoExportMessage    = "Fast refresh only works when a file has exports. Move your component(s) to a separate file."
  reactRefreshContextMessage     = "Fast refresh only works when a file only exports components. Move your React context(s) to a separate file."
)

func (onlyExportComponents) Name() string {
  return "react-refresh/only-export-components"
}

func (onlyExportComponents) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}

func (onlyExportComponents) Check(ctx *Context, node *shimast.Node) {
  if ctx.File == nil || node == nil || node.Kind != shimast.KindSourceFile {
    return
  }

  var options onlyExportComponentsOptions
  if err := ctx.DecodeOptions(&options); err != nil {
    return
  }
  if !shouldScanReactRefreshFile(ctx.File.FileName(), options.CheckJS) {
    return
  }

  scan := newReactRefreshScan(ctx, options, reactRefreshRequiresReactImport(ctx.File.FileName(), options.CheckJS))
  for _, stmt := range node.Statements() {
    scan.handleStatement(stmt)
  }
  scan.report()
}

func newReactRefreshScan(ctx *Context, options onlyExportComponentsOptions, requireReactImport bool) *reactRefreshScan {
  validHOCs := map[string]bool{
    "memo":       true,
    "forwardRef": true,
    "lazy":       true,
  }
  for _, name := range options.ExtraHOCs {
    if name != "" {
      validHOCs[name] = true
    }
  }
  allowed := map[string]bool{}
  for _, name := range options.AllowExportNames {
    if name != "" {
      allowed[name] = true
    }
  }
  return &reactRefreshScan{
    ctx:                ctx,
    options:            options,
    allowedExportNames: allowed,
    validHOCs:          validHOCs,
    requireReactImport: requireReactImport,
  }
}

func shouldScanReactRefreshFile(fileName string, checkJS bool) bool {
  lower := strings.ToLower(fileName)
  if strings.Contains(lower, ".test.") ||
    strings.Contains(lower, ".spec.") ||
    strings.Contains(lower, ".cy.") ||
    strings.Contains(lower, ".stories.") {
    return false
  }
  return strings.HasSuffix(lower, ".tsx") ||
    strings.HasSuffix(lower, ".jsx") ||
    (checkJS && strings.HasSuffix(lower, ".js"))
}

func reactRefreshRequiresReactImport(fileName string, checkJS bool) bool {
  return checkJS && strings.HasSuffix(strings.ToLower(fileName), ".js")
}

func (s *reactRefreshScan) handleStatement(stmt *shimast.Node) {
  if stmt == nil {
    return
  }
  switch stmt.Kind {
  case shimast.KindImportDeclaration:
    decl := stmt.AsImportDeclaration()
    s.reactIsInScope = s.reactIsInScope ||
      decl != nil && stringLiteralText(decl.ModuleSpecifier) == "react"

  case shimast.KindExportDeclaration:
    s.handleExportDeclaration(stmt)

  case shimast.KindExportAssignment:
    assignment := stmt.AsExportAssignment()
    if assignment == nil || assignment.IsExportEquals || assignment.Expression == nil {
      return
    }
    s.hasExports = true
    s.handleDefaultExportExpression(assignment.Expression, stmt)

  case shimast.KindVariableStatement:
    if hasModifier(stmt, shimast.KindExportKeyword) {
      s.hasExports = true
      s.handleVariableStatement(stmt)
      return
    }
    s.collectLocalVariableComponents(stmt)

  case shimast.KindFunctionDeclaration:
    if hasModifier(stmt, shimast.KindExportKeyword) {
      s.hasExports = true
      s.handleFunctionDeclaration(stmt)
      return
    }
    if isReactComponentName(identifierText(stmt.Name())) {
      s.localComponents = append(s.localComponents, stmt.Name())
    }

  case shimast.KindClassDeclaration:
    if hasModifier(stmt, shimast.KindExportKeyword) {
      s.hasExports = true
      s.handleClassDeclaration(stmt)
    }
  }
}

func (s *reactRefreshScan) handleExportDeclaration(node *shimast.Node) {
  decl := node.AsExportDeclaration()
  if decl == nil || decl.IsTypeOnly {
    return
  }
  s.hasExports = true
  if decl.ExportClause == nil {
    s.ctx.Report(node, "This rule can't verify that export * only exports components.")
    return
  }
  if decl.ExportClause.Kind != shimast.KindNamedExports {
    return
  }
  named := decl.ExportClause.AsNamedExports()
  if named == nil || named.Elements == nil {
    return
  }
  for _, el := range named.Elements.Nodes {
    spec := el.AsExportSpecifier()
    if spec == nil || spec.IsTypeOnly {
      continue
    }
    exported := spec.Name()
    if identifierText(exported) == "default" && spec.PropertyName != nil {
      exported = spec.PropertyName
    }
    s.handleExportIdentifier(exported, nil)
  }
}

func (s *reactRefreshScan) handleVariableStatement(node *shimast.Node) {
  stmt := node.AsVariableStatement()
  if stmt == nil || stmt.DeclarationList == nil {
    return
  }
  list := stmt.DeclarationList.AsVariableDeclarationList()
  if list == nil || list.Declarations == nil {
    return
  }
  for _, declNode := range list.Declarations.Nodes {
    decl := declNode.AsVariableDeclaration()
    if decl == nil {
      continue
    }
    if decl.Initializer == nil {
      s.nonComponentExports = append(s.nonComponentExports, decl.Name())
      continue
    }
    s.handleExportIdentifier(decl.Name(), decl.Initializer)
  }
}

func (s *reactRefreshScan) collectLocalVariableComponents(node *shimast.Node) {
  stmt := node.AsVariableStatement()
  if stmt == nil || stmt.DeclarationList == nil {
    return
  }
  list := stmt.DeclarationList.AsVariableDeclarationList()
  if list == nil || list.Declarations == nil {
    return
  }
  for _, declNode := range list.Declarations.Nodes {
    decl := declNode.AsVariableDeclaration()
    if decl == nil || decl.Initializer == nil || !isReactComponentName(identifierText(decl.Name())) {
      continue
    }
    if s.isExpressionReactComponent(decl.Initializer) != reactComponentExpressionNo {
      s.localComponents = append(s.localComponents, decl.Name())
    }
  }
}

func (s *reactRefreshScan) handleFunctionDeclaration(node *shimast.Node) {
  name := node.Name()
  if name == nil {
    s.ctx.Report(node, reactRefreshAnonymousMessage)
    return
  }
  s.handleExportIdentifier(name, nil)
}

func (s *reactRefreshScan) handleClassDeclaration(node *shimast.Node) {
  name := node.Name()
  if name == nil {
    s.ctx.Report(node, reactRefreshAnonymousMessage)
    return
  }
  if isReactComponentName(identifierText(name)) && classHasRenderMethod(node) {
    s.hasReactExport = true
    return
  }
  s.nonComponentExports = append(s.nonComponentExports, name)
}

func (s *reactRefreshScan) handleDefaultExportExpression(expr *shimast.Node, exportNode *shimast.Node) {
  expr = skipReactRefreshTSWrapper(expr)
  if expr == nil {
    return
  }
  switch expr.Kind {
  case shimast.KindIdentifier:
    s.handleExportIdentifier(expr, nil)
  case shimast.KindCallExpression:
    switch result := s.isCallExpressionReactComponent(expr); result {
    case reactComponentExpressionNo:
      s.nonComponentExports = append(s.nonComponentExports, expr)
    case reactComponentExpressionNeedName:
      s.ctx.Report(exportNode, reactRefreshAnonymousMessage)
    default:
      s.hasReactExport = true
    }
  case shimast.KindArrowFunction:
    s.ctx.Report(exportNode, reactRefreshAnonymousMessage)
  case shimast.KindFunctionDeclaration, shimast.KindFunctionExpression:
    name := expr.Name()
    if name == nil {
      s.ctx.Report(exportNode, reactRefreshAnonymousMessage)
      return
    }
    s.handleExportIdentifier(name, nil)
  case shimast.KindClassDeclaration:
    s.handleClassDeclaration(expr)
  default:
    s.nonComponentExports = append(s.nonComponentExports, expr)
  }
}

func (s *reactRefreshScan) handleExportIdentifier(nameNode *shimast.Node, init *shimast.Node) {
  name := identifierText(nameNode)
  if name == "" {
    s.nonComponentExports = append(s.nonComponentExports, nameNode)
    return
  }
  if s.allowedExportNames[name] {
    return
  }
  if init == nil {
    if isReactComponentName(name) {
      s.hasReactExport = true
      return
    }
    s.nonComponentExports = append(s.nonComponentExports, nameNode)
    return
  }

  init = skipReactRefreshTSWrapper(init)
  if s.options.AllowConstantExport && isReactRefreshConstantExpression(init) {
    return
  }
  if isCreateContextCall(init) {
    s.reactContextExports = append(s.reactContextExports, nameNode)
    return
  }
  if isReactComponentName(name) && s.isExpressionReactComponent(init) != reactComponentExpressionNo {
    s.hasReactExport = true
    return
  }
  s.nonComponentExports = append(s.nonComponentExports, nameNode)
}

func (s *reactRefreshScan) report() {
  if s.requireReactImport && !s.reactIsInScope {
    return
  }
  if s.hasExports {
    if s.hasReactExport {
      for _, node := range s.nonComponentExports {
        s.ctx.Report(node, reactRefreshNamedExportMessage)
      }
      for _, node := range s.reactContextExports {
        s.ctx.Report(node, reactRefreshContextMessage)
      }
      return
    }
    for _, node := range s.localComponents {
      s.ctx.Report(node, reactRefreshLocalMessage)
    }
    return
  }
  for _, node := range s.localComponents {
    s.ctx.Report(node, reactRefreshNoExportMessage)
  }
}

func isReactComponentName(name string) bool {
  if name == "" {
    return false
  }
  first := name[0]
  if first < 'A' || first > 'Z' {
    return false
  }
  for i := 1; i < len(name); i++ {
    ch := name[i]
    if (ch >= 'a' && ch <= 'z') ||
      (ch >= 'A' && ch <= 'Z') ||
      (ch >= '0' && ch <= '9') ||
      ch == '_' {
      continue
    }
    return false
  }
  return true
}

func skipReactRefreshTSWrapper(node *shimast.Node) *shimast.Node {
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

func (s *reactRefreshScan) isExpressionReactComponent(node *shimast.Node) reactComponentExpressionResult {
  node = skipReactRefreshTSWrapper(node)
  if node == nil {
    return reactComponentExpressionNo
  }
  switch node.Kind {
  case shimast.KindIdentifier:
    if isReactComponentName(identifierText(node)) {
      return reactComponentExpressionYes
    }
  case shimast.KindArrowFunction:
    return reactComponentExpressionNeedName
  case shimast.KindFunctionExpression:
    name := identifierText(node.Name())
    if name == "" {
      return reactComponentExpressionNeedName
    }
    if isReactComponentName(name) {
      return reactComponentExpressionYes
    }
  case shimast.KindConditionalExpression:
    expr := node.AsConditionalExpression()
    if expr == nil {
      return reactComponentExpressionNo
    }
    left := s.isExpressionReactComponent(expr.WhenTrue)
    right := s.isExpressionReactComponent(expr.WhenFalse)
    if left == reactComponentExpressionNo || right == reactComponentExpressionNo {
      return reactComponentExpressionNo
    }
    if left == reactComponentExpressionNeedName || right == reactComponentExpressionNeedName {
      return reactComponentExpressionNeedName
    }
    return reactComponentExpressionYes
  case shimast.KindCallExpression:
    return s.isCallExpressionReactComponent(node)
  case shimast.KindTaggedTemplateExpression:
    if s.validHOCs[s.hocName(node)] {
      return reactComponentExpressionNeedName
    }
  }
  return reactComponentExpressionNo
}

func (s *reactRefreshScan) isCallExpressionReactComponent(node *shimast.Node) reactComponentExpressionResult {
  hoc := s.hocName(node)
  if !s.validHOCs[hoc] {
    return reactComponentExpressionNo
  }
  if hoc != "memo" && hoc != "forwardRef" {
    return reactComponentExpressionYes
  }
  call := node.AsCallExpression()
  if call == nil || call.Arguments == nil || len(call.Arguments.Nodes) == 0 {
    return reactComponentExpressionNo
  }
  arg := skipReactRefreshTSWrapper(call.Arguments.Nodes[0])
  if arg == nil {
    return reactComponentExpressionNo
  }
  switch arg.Kind {
  case shimast.KindIdentifier:
    if isReactComponentName(identifierText(arg)) {
      return reactComponentExpressionYes
    }
  case shimast.KindFunctionExpression:
    name := identifierText(arg.Name())
    if name == "" {
      return reactComponentExpressionNeedName
    }
    if isReactComponentName(name) {
      return reactComponentExpressionYes
    }
  case shimast.KindArrowFunction:
    return reactComponentExpressionNeedName
  case shimast.KindCallExpression:
    return s.isCallExpressionReactComponent(arg)
  }
  return reactComponentExpressionNo
}

func (s *reactRefreshScan) hocName(node *shimast.Node) string {
  node = skipReactRefreshTSWrapper(node)
  if node == nil {
    return ""
  }
  var callee *shimast.Node
  switch node.Kind {
  case shimast.KindCallExpression:
    call := node.AsCallExpression()
    if call != nil {
      callee = call.Expression
    }
  case shimast.KindTaggedTemplateExpression:
    tagged := node.AsTaggedTemplateExpression()
    if tagged != nil {
      callee = tagged.Tag
    }
  default:
    return ""
  }
  return s.calleeHOCName(callee)
}

func (s *reactRefreshScan) calleeHOCName(node *shimast.Node) string {
  node = skipReactRefreshTSWrapper(node)
  if node == nil {
    return ""
  }
  switch node.Kind {
  case shimast.KindIdentifier:
    return identifierText(node)
  case shimast.KindCallExpression:
    return s.hocName(node)
  case shimast.KindPropertyAccessExpression:
    access := node.AsPropertyAccessExpression()
    if access == nil {
      return ""
    }
    property := identifierText(access.Name())
    if s.validHOCs[property] {
      return property
    }
    object := identifierText(access.Expression)
    if s.validHOCs[object] {
      return object
    }
    if access.Expression != nil && access.Expression.Kind == shimast.KindCallExpression {
      return s.hocName(access.Expression)
    }
  }
  return ""
}

func isReactRefreshConstantExpression(node *shimast.Node) bool {
  node = skipReactRefreshTSWrapper(node)
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindStringLiteral,
    shimast.KindNumericLiteral,
    shimast.KindBigIntLiteral,
    shimast.KindNoSubstitutionTemplateLiteral,
    shimast.KindTrueKeyword,
    shimast.KindFalseKeyword,
    shimast.KindNullKeyword,
    shimast.KindPrefixUnaryExpression,
    shimast.KindTemplateExpression,
    shimast.KindBinaryExpression:
    return true
  }
  return false
}

func isCreateContextCall(node *shimast.Node) bool {
  node = skipReactRefreshTSWrapper(node)
  if node == nil || node.Kind != shimast.KindCallExpression {
    return false
  }
  call := node.AsCallExpression()
  if call == nil {
    return false
  }
  if identifierText(call.Expression) == "createContext" {
    return true
  }
  access := call.Expression.AsPropertyAccessExpression()
  return access != nil && identifierText(access.Name()) == "createContext"
}

func classHasRenderMethod(node *shimast.Node) bool {
  class := node.AsClassDeclaration()
  if class == nil || class.Members == nil {
    return false
  }
  for _, member := range class.Members.Nodes {
    if member == nil || member.Kind != shimast.KindMethodDeclaration {
      continue
    }
    if identifierText(member.Name()) == "render" {
      return true
    }
  }
  return false
}

func init() {
  Register(onlyExportComponents{})
}
