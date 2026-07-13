package linthost

import (
  "strings"
  "unicode/utf8"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

const securityRulePrefix = "security/"

type securityDetectBidiCharacters struct{}

func (securityDetectBidiCharacters) Name() string {
  return securityRulePrefix + "detect-bidi-characters"
}
func (securityDetectBidiCharacters) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (securityDetectBidiCharacters) Check(ctx *Context, node *shimast.Node) {
  if ctx.File == nil {
    return
  }
  for pos, r := range ctx.File.Text() {
    if isBidiControlRune(r) {
      ctx.ReportRange(pos, pos+utf8.RuneLen(r), "Detected potential trojan source bidi control character.")
    }
  }
}

type securityDetectBufferNoassert struct{}

func (securityDetectBufferNoassert) Name() string {
  return securityRulePrefix + "detect-buffer-noassert"
}
func (securityDetectBufferNoassert) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (securityDetectBufferNoassert) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || call.Arguments == nil {
    return
  }
  _, method, ok := propertyAccessParts(call.Expression)
  if !ok {
    return
  }
  idx, ok := bufferNoAssertIndex(method)
  if !ok || len(call.Arguments.Nodes) <= idx || !isTrueLiteral(call.Arguments.Nodes[idx]) {
    return
  }
  ctx.Report(node, "Buffer method called with noAssert set to true.")
}

type securityDetectChildProcess struct{}

func (securityDetectChildProcess) Name() string { return securityRulePrefix + "detect-child-process" }
func (securityDetectChildProcess) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (securityDetectChildProcess) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil {
    return
  }
  bindings := collectSecurityBindings(ctx.File)
  if module, ok := requireCallModule(call); ok && isChildProcessModule(module) {
    if isInlineChildProcessExecRequire(node, bindings) {
      return
    }
    ctx.Report(node, "Found require(\""+module+"\").")
    return
  }
  if call.Arguments == nil || len(call.Arguments.Nodes) == 0 ||
    isSecurityStaticExpression(call.Arguments.Nodes[0], bindings, nil) {
    return
  }
  if isChildProcessExecCall(call, bindings) {
    ctx.Report(node, "Found child_process.exec() with non-literal first argument.")
  }
}

type securityDetectDisableMustacheEscape struct{}

func (securityDetectDisableMustacheEscape) Name() string {
  return securityRulePrefix + "detect-disable-mustache-escape"
}
func (securityDetectDisableMustacheEscape) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindBinaryExpression}
}
func (securityDetectDisableMustacheEscape) Check(ctx *Context, node *shimast.Node) {
  expr := node.AsBinaryExpression()
  if expr == nil || expr.OperatorToken == nil || expr.OperatorToken.Kind != shimast.KindEqualsToken {
    return
  }
  _, prop, ok := propertyAccessParts(expr.Left)
  if ok && prop == "escapeMarkup" && isFalseLiteral(expr.Right) {
    ctx.Report(node, "Markup escaping disabled.")
  }
}

type securityDetectEvalWithExpression struct{}

func (securityDetectEvalWithExpression) Name() string {
  return securityRulePrefix + "detect-eval-with-expression"
}
func (securityDetectEvalWithExpression) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (securityDetectEvalWithExpression) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || callCalleeName(call) != "eval" || call.Arguments == nil || len(call.Arguments.Nodes) == 0 {
    return
  }
  bindings := collectSecurityBindings(ctx.File)
  if !isSecurityStaticExpression(call.Arguments.Nodes[0], bindings, nil) {
    ctx.Report(node, "eval called with a non-literal expression.")
  }
}

type securityDetectNewBuffer struct{}

func (securityDetectNewBuffer) Name() string { return securityRulePrefix + "detect-new-buffer" }
func (securityDetectNewBuffer) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindNewExpression}
}
func (securityDetectNewBuffer) Check(ctx *Context, node *shimast.Node) {
  expr := node.AsNewExpression()
  if expr == nil || identifierText(expr.Expression) != "Buffer" || expr.Arguments == nil || len(expr.Arguments.Nodes) == 0 {
    return
  }
  bindings := collectSecurityBindings(ctx.File)
  if !isSecurityStaticExpression(expr.Arguments.Nodes[0], bindings, nil) {
    ctx.Report(node, "Found new Buffer with a non-literal argument.")
  }
}

type securityDetectNoCSRFBeforeMethodOverride struct{}

func (securityDetectNoCSRFBeforeMethodOverride) Name() string {
  return securityRulePrefix + "detect-no-csrf-before-method-override"
}
func (securityDetectNoCSRFBeforeMethodOverride) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (securityDetectNoCSRFBeforeMethodOverride) Check(ctx *Context, node *shimast.Node) {
  seenCSRF := false
  walkDescendants(node, func(child *shimast.Node) {
    if child == nil || child.Kind != shimast.KindCallExpression {
      return
    }
    call := child.AsCallExpression()
    _, method, ok := propertyAccessParts(call.Expression)
    if !ok {
      return
    }
    switch method {
    case "csrf":
      seenCSRF = true
    case "methodOverride":
      if seenCSRF {
        ctx.Report(child, "CSRF middleware is configured before methodOverride.")
      }
    }
  })
}

type securityDetectNonLiteralFSFilename struct{}

func (securityDetectNonLiteralFSFilename) Name() string {
  return securityRulePrefix + "detect-non-literal-fs-filename"
}
func (securityDetectNonLiteralFSFilename) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (securityDetectNonLiteralFSFilename) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || call.Arguments == nil || len(call.Arguments.Nodes) == 0 {
    return
  }
  bindings := collectSecurityBindings(ctx.File)
  method, module, ok := fsCallInfo(call, bindings)
  if !ok || !isFSFilenameMethod(method) {
    return
  }
  if !isSecurityStaticExpression(call.Arguments.Nodes[0], bindings, nil) {
    ctx.Report(node, "Found "+method+" from package \""+module+"\" with non-literal filename argument.")
  }
}

type securityDetectNonLiteralRegexp struct{}

func (securityDetectNonLiteralRegexp) Name() string {
  return securityRulePrefix + "detect-non-literal-regexp"
}
func (securityDetectNonLiteralRegexp) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindNewExpression, shimast.KindCallExpression}
}
func (securityDetectNonLiteralRegexp) Check(ctx *Context, node *shimast.Node) {
  var args []*shimast.Node
  switch node.Kind {
  case shimast.KindNewExpression:
    expr := node.AsNewExpression()
    if expr == nil || identifierText(expr.Expression) != "RegExp" || expr.Arguments == nil {
      return
    }
    args = expr.Arguments.Nodes
  case shimast.KindCallExpression:
    call := node.AsCallExpression()
    if call == nil || identifierText(call.Expression) != "RegExp" || call.Arguments == nil {
      return
    }
    args = call.Arguments.Nodes
  }
  if len(args) == 0 {
    return
  }
  bindings := collectSecurityBindings(ctx.File)
  if !isSecurityStaticExpression(args[0], bindings, nil) {
    ctx.Report(node, "Found non-literal argument to RegExp constructor.")
  }
}

type securityDetectNonLiteralRequire struct{}

func (securityDetectNonLiteralRequire) Name() string {
  return securityRulePrefix + "detect-non-literal-require"
}
func (securityDetectNonLiteralRequire) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression}
}
func (securityDetectNonLiteralRequire) Check(ctx *Context, node *shimast.Node) {
  call := node.AsCallExpression()
  if call == nil || callCalleeName(call) != "require" || call.Arguments == nil || len(call.Arguments.Nodes) == 0 {
    return
  }
  bindings := collectSecurityBindings(ctx.File)
  if !isSecurityStaticExpression(call.Arguments.Nodes[0], bindings, nil) {
    ctx.Report(node, "Found non-literal argument in require.")
  }
}

type securityDetectObjectInjection struct{}

func (securityDetectObjectInjection) Name() string {
  return securityRulePrefix + "detect-object-injection"
}
func (securityDetectObjectInjection) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindElementAccessExpression}
}
func (securityDetectObjectInjection) Check(ctx *Context, node *shimast.Node) {
  access := node.AsElementAccessExpression()
  if access == nil || isStaticPropertyKey(access.ArgumentExpression) {
    return
  }
  ctx.Report(node, "Generic object injection sink.")
}

type securityDetectPossibleTimingAttacks struct{}

func (securityDetectPossibleTimingAttacks) Name() string {
  return securityRulePrefix + "detect-possible-timing-attacks"
}
func (securityDetectPossibleTimingAttacks) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindBinaryExpression}
}
func (securityDetectPossibleTimingAttacks) Check(ctx *Context, node *shimast.Node) {
  expr := node.AsBinaryExpression()
  if expr == nil || expr.OperatorToken == nil || !isEqualityOperator(expr.OperatorToken.Kind) {
    return
  }
  if containsSecretIdentifier(expr.Left) || containsSecretIdentifier(expr.Right) {
    ctx.Report(node, "Potential timing attack from direct secret comparison.")
  }
}

type securityDetectPseudoRandomBytes struct{}

func (securityDetectPseudoRandomBytes) Name() string {
  return securityRulePrefix + "detect-pseudoRandomBytes"
}
func (securityDetectPseudoRandomBytes) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindPropertyAccessExpression}
}
func (securityDetectPseudoRandomBytes) Check(ctx *Context, node *shimast.Node) {
  obj, prop, ok := propertyAccessParts(node)
  if ok && prop == "pseudoRandomBytes" && identifierText(obj) == "crypto" {
    ctx.Report(node, "Found crypto.pseudoRandomBytes which is not cryptographically strong.")
  }
}

type securityDetectUnsafeRegex struct{}

func (securityDetectUnsafeRegex) Name() string { return securityRulePrefix + "detect-unsafe-regex" }
func (securityDetectUnsafeRegex) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindRegularExpressionLiteral, shimast.KindNewExpression}
}
func (securityDetectUnsafeRegex) Check(ctx *Context, node *shimast.Node) {
  pattern := ""
  if node.Kind == shimast.KindRegularExpressionLiteral {
    pattern = regexpPatternFromLiteral(nodeText(ctx.File, node))
  } else {
    expr := node.AsNewExpression()
    if expr == nil || identifierText(expr.Expression) != "RegExp" || expr.Arguments == nil || len(expr.Arguments.Nodes) == 0 {
      return
    }
    pattern = stringLiteralText(expr.Arguments.Nodes[0])
  }
  if looksUnsafeRegex(pattern) {
    ctx.Report(node, "Unsafe regular expression.")
  }
}

type securityNamedBinding struct {
  Module string
  Import string
}

type securityBindings struct {
  Modules map[string]string
  Named   map[string]securityNamedBinding
  Static  map[string]bool
}

func collectSecurityBindings(file *shimast.SourceFile) securityBindings {
  bindings := securityBindings{
    Modules: map[string]string{},
    Named:   map[string]securityNamedBinding{},
    Static:  map[string]bool{},
  }
  if file == nil {
    return bindings
  }
  assigned := collectSecurityAssignedNames(file.AsNode())
  walkDescendants(file.AsNode(), func(node *shimast.Node) {
    if node == nil {
      return
    }
    switch node.Kind {
    case shimast.KindImportDeclaration:
      collectSecurityImportBindings(node, bindings)
    case shimast.KindVariableDeclaration:
      collectSecurityVariableBinding(node, bindings, assigned)
    }
  })
  return bindings
}

func collectSecurityAssignedNames(node *shimast.Node) map[string]bool {
  assigned := map[string]bool{}
  walkDescendants(node, func(child *shimast.Node) {
    if child == nil {
      return
    }
    switch child.Kind {
    case shimast.KindBinaryExpression:
      expr := child.AsBinaryExpression()
      if expr == nil || expr.OperatorToken == nil || !isAssignmentOperator(expr.OperatorToken.Kind) {
        return
      }
      for _, name := range assignmentTargetNames(expr.Left) {
        assigned[name] = true
      }
    case shimast.KindPrefixUnaryExpression:
      expr := child.AsPrefixUnaryExpression()
      if expr == nil {
        return
      }
      if expr.Operator == shimast.KindPlusPlusToken || expr.Operator == shimast.KindMinusMinusToken {
        for _, name := range assignmentTargetNames(expr.Operand) {
          assigned[name] = true
        }
      }
    case shimast.KindPostfixUnaryExpression:
      expr := child.AsPostfixUnaryExpression()
      if expr == nil {
        return
      }
      if expr.Operator == shimast.KindPlusPlusToken || expr.Operator == shimast.KindMinusMinusToken {
        for _, name := range assignmentTargetNames(expr.Operand) {
          assigned[name] = true
        }
      }
    case shimast.KindForOfStatement, shimast.KindForInStatement:
      stmt := child.AsForInOrOfStatement()
      if stmt == nil || stmt.Initializer == nil || stmt.Initializer.Kind == shimast.KindVariableDeclarationList {
        return
      }
      for _, name := range assignmentTargetNames(stmt.Initializer) {
        assigned[name] = true
      }
    }
  })
  return assigned
}

func collectSecurityImportBindings(node *shimast.Node, bindings securityBindings) {
  decl := node.AsImportDeclaration()
  if decl == nil || decl.ImportClause == nil {
    return
  }
  module := stringLiteralText(decl.ModuleSpecifier)
  if module == "" {
    return
  }
  clause := decl.ImportClause.AsImportClause()
  if clause == nil {
    return
  }
  if name := identifierText(clause.Name()); name != "" {
    bindings.Modules[name] = module
  }
  if clause.NamedBindings == nil {
    return
  }
  switch clause.NamedBindings.Kind {
  case shimast.KindNamespaceImport:
    if ns := clause.NamedBindings.AsNamespaceImport(); ns != nil {
      bindings.Modules[identifierText(ns.Name())] = module
    }
  case shimast.KindNamedImports:
    named := clause.NamedBindings.AsNamedImports()
    if named == nil || named.Elements == nil {
      return
    }
    for _, el := range named.Elements.Nodes {
      spec := el.AsImportSpecifier()
      if spec == nil {
        continue
      }
      local := identifierText(spec.Name())
      imported := local
      if spec.PropertyName != nil {
        imported = identifierText(spec.PropertyName)
      }
      if local != "" && imported != "" {
        bindings.Named[local] = securityNamedBinding{Module: module, Import: imported}
      }
    }
  }
}

func collectSecurityVariableBinding(node *shimast.Node, bindings securityBindings, assigned map[string]bool) {
  decl := node.AsVariableDeclaration()
  if decl == nil || decl.Initializer == nil {
    return
  }
  name := decl.Name()
  if local := identifierText(name); local != "" {
    if isStableSecurityDeclaration(node, local, assigned) {
      collectSecurityIdentifierBinding(local, decl.Initializer, bindings)
    }
    if isStableSecurityDeclaration(node, local, assigned) &&
      isSecurityStaticExpression(decl.Initializer, bindings, map[string]bool{local: true}) {
      bindings.Static[local] = true
    } else {
      delete(bindings.Static, local)
    }
    return
  }
  if name == nil || name.Kind != shimast.KindObjectBindingPattern {
    return
  }
  module, ok := moduleFromExpression(decl.Initializer, bindings)
  if !ok {
    return
  }
  pattern := name.AsBindingPattern()
  if pattern == nil || pattern.Elements == nil {
    return
  }
  for _, el := range pattern.Elements.Nodes {
    binding := el.AsBindingElement()
    if binding == nil {
      continue
    }
    local := identifierText(binding.Name())
    imported := local
    if binding.PropertyName != nil {
      imported = identifierText(binding.PropertyName)
    }
    if local != "" && imported != "" && isStableSecurityDeclaration(node, local, assigned) {
      bindings.Named[local] = securityNamedBinding{Module: module, Import: imported}
    }
  }
}

func isStableSecurityDeclaration(node *shimast.Node, local string, assigned map[string]bool) bool {
  if local == "" || assigned[local] {
    return false
  }
  return shimast.IsConst(node) || shimast.IsLet(node) || shimast.IsVar(node)
}

func collectSecurityIdentifierBinding(local string, init *shimast.Node, bindings securityBindings) {
  if module, ok := requireExpressionModule(init); ok {
    bindings.Modules[local] = module
    return
  }
  if obj, prop, ok := propertyAccessParts(init); ok {
    if module, ok := requireExpressionModule(obj); ok {
      if prop == "promises" {
        bindings.Modules[local] = module
      } else {
        bindings.Named[local] = securityNamedBinding{Module: module, Import: prop}
      }
      return
    }
    if module, ok := bindings.Modules[identifierText(obj)]; ok && prop == "promises" {
      bindings.Modules[local] = module
    }
  }
}

func moduleFromExpression(node *shimast.Node, bindings securityBindings) (string, bool) {
  if module, ok := requireExpressionModule(node); ok {
    return module, true
  }
  if obj, prop, ok := propertyAccessParts(node); ok && prop == "promises" {
    if module, ok := requireExpressionModule(obj); ok {
      return module, true
    }
    if module, ok := bindings.Modules[identifierText(obj)]; ok {
      return module, true
    }
  }
  return "", false
}

func propertyAccessParts(node *shimast.Node) (*shimast.Node, string, bool) {
  node = stripParens(node)
  if node == nil || node.Kind != shimast.KindPropertyAccessExpression {
    return nil, "", false
  }
  access := node.AsPropertyAccessExpression()
  if access == nil {
    return nil, "", false
  }
  prop := identifierText(access.Name())
  return access.Expression, prop, prop != ""
}

func requireCallModule(call *shimast.CallExpression) (string, bool) {
  if call == nil || callCalleeName(call) != "require" || call.Arguments == nil || len(call.Arguments.Nodes) == 0 {
    return "", false
  }
  module := stringLiteralText(call.Arguments.Nodes[0])
  return module, module != ""
}

func requireExpressionModule(node *shimast.Node) (string, bool) {
  node = stripParens(node)
  if node == nil || node.Kind != shimast.KindCallExpression {
    return "", false
  }
  return requireCallModule(node.AsCallExpression())
}

func isSecurityStaticExpression(node *shimast.Node, bindings securityBindings, seen map[string]bool) bool {
  node = stripParens(node)
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindStringLiteral,
    shimast.KindNumericLiteral,
    shimast.KindBigIntLiteral,
    shimast.KindNoSubstitutionTemplateLiteral,
    shimast.KindRegularExpressionLiteral,
    shimast.KindTrueKeyword,
    shimast.KindFalseKeyword,
    shimast.KindNullKeyword:
    return true
  case shimast.KindIdentifier:
    name := identifierText(node)
    if name == "__dirname" || name == "__filename" {
      return true
    }
    if seen != nil && seen[name] {
      return false
    }
    return bindings.Static[name]
  case shimast.KindTemplateExpression:
    expr := node.AsTemplateExpression()
    if expr == nil || expr.TemplateSpans == nil {
      return false
    }
    for _, spanNode := range expr.TemplateSpans.Nodes {
      span := spanNode.AsTemplateSpan()
      if span == nil || !isSecurityStaticExpression(span.Expression, bindings, seen) {
        return false
      }
    }
    return true
  case shimast.KindBinaryExpression:
    expr := node.AsBinaryExpression()
    return expr != nil && expr.OperatorToken != nil && expr.OperatorToken.Kind == shimast.KindPlusToken &&
      isSecurityStaticExpression(expr.Left, bindings, seen) &&
      isSecurityStaticExpression(expr.Right, bindings, seen)
  case shimast.KindCallExpression:
    return isSecurityStaticCall(node.AsCallExpression(), bindings, seen)
  case shimast.KindPropertyAccessExpression:
    return isMatchingPropertyAccess(node, "import", "meta", "url")
  case shimast.KindMetaProperty:
    return nodeText(nil, node) == "import.meta"
  }
  return false
}

func isSecurityStaticCall(call *shimast.CallExpression, bindings securityBindings, seen map[string]bool) bool {
  if call == nil || call.Arguments == nil {
    return false
  }
  if isMatchingPropertyAccess(call.Expression, "process", "cwd") && len(call.Arguments.Nodes) == 0 {
    return true
  }
  if isMatchingPropertyAccess(call.Expression, "require", "resolve") {
    return len(call.Arguments.Nodes) > 0 && isSecurityStaticExpression(call.Arguments.Nodes[0], bindings, seen)
  }
  obj, method, ok := propertyAccessParts(call.Expression)
  if !ok || call.Arguments == nil {
    return false
  }
  objectName := identifierText(obj)
  if (objectName == "path" || bindings.Modules[objectName] == "path" || bindings.Modules[objectName] == "node:path") &&
    (method == "join" || method == "resolve" || method == "dirname") {
    for _, arg := range call.Arguments.Nodes {
      if !isSecurityStaticExpression(arg, bindings, seen) {
        return false
      }
    }
    return true
  }
  return false
}

func isChildProcessExecCall(call *shimast.CallExpression, bindings securityBindings) bool {
  callee := stripParens(call.Expression)
  if name := identifierText(callee); name != "" {
    binding, ok := bindings.Named[name]
    return ok && isChildProcessModule(binding.Module) && binding.Import == "exec"
  }
  obj, prop, ok := propertyAccessParts(callee)
  if !ok || prop != "exec" {
    return false
  }
  if module, ok := requireExpressionModule(obj); ok {
    return isChildProcessModule(module)
  }
  module, ok := bindings.Modules[identifierText(obj)]
  return ok && isChildProcessModule(module)
}

func isInlineChildProcessExecRequire(node *shimast.Node, bindings securityBindings) bool {
  parent := node.Parent
  if parent == nil || parent.Kind != shimast.KindPropertyAccessExpression {
    return false
  }
  access := parent.AsPropertyAccessExpression()
  if access == nil || access.Expression != node || identifierText(access.Name()) != "exec" {
    return false
  }
  outerNode := parent.Parent
  if outerNode == nil || outerNode.Kind != shimast.KindCallExpression {
    return false
  }
  outer := outerNode.AsCallExpression()
  if outer == nil || outer.Expression != parent || outer.Arguments == nil || len(outer.Arguments.Nodes) == 0 {
    return false
  }
  return !isSecurityStaticExpression(outer.Arguments.Nodes[0], bindings, nil) &&
    isChildProcessExecCall(outer, bindings)
}

func fsCallInfo(call *shimast.CallExpression, bindings securityBindings) (string, string, bool) {
  callee := stripParens(call.Expression)
  if name := identifierText(callee); name != "" {
    binding, ok := bindings.Named[name]
    if ok && isFSModule(binding.Module) {
      return binding.Import, binding.Module, true
    }
  }
  obj, method, ok := propertyAccessParts(callee)
  if !ok {
    return "", "", false
  }
  if inner, prop, ok := propertyAccessParts(obj); ok && prop == "promises" {
    if module, ok := requireExpressionModule(inner); ok && isFSModule(module) {
      return method, module, true
    }
    if module, ok := bindings.Modules[identifierText(inner)]; ok && isFSModule(module) {
      return method, module, true
    }
  }
  if module, ok := requireExpressionModule(obj); ok && isFSModule(module) {
    return method, module, true
  }
  if module, ok := bindings.Modules[identifierText(obj)]; ok && isFSModule(module) {
    return method, module, true
  }
  return "", "", false
}

func bufferNoAssertIndex(method string) (int, bool) {
  if strings.HasPrefix(method, "read") {
    switch method {
    case "readUInt8", "readUInt16LE", "readUInt16BE", "readUInt32LE", "readUInt32BE",
      "readInt8", "readInt16LE", "readInt16BE", "readInt32LE", "readInt32BE",
      "readFloatLE", "readFloatBE", "readDoubleLE", "readDoubleBE":
      return 1, true
    }
  }
  if strings.HasPrefix(method, "write") {
    switch method {
    case "writeUInt8", "writeUInt16LE", "writeUInt16BE", "writeUInt32LE", "writeUInt32BE",
      "writeInt8", "writeInt16LE", "writeInt16BE", "writeInt32LE", "writeInt32BE",
      "writeFloatLE", "writeFloatBE", "writeDoubleLE", "writeDoubleBE":
      return 2, true
    }
  }
  return 0, false
}

func isFSFilenameMethod(method string) bool {
  switch method {
  case "access", "appendFile", "chmod", "chown", "copyFile", "createReadStream", "createWriteStream",
    "exists", "lchmod", "lchown", "link", "lstat", "mkdir", "mkdtemp", "open", "opendir",
    "readFile", "readdir", "readlink", "realpath", "rename", "rm", "rmdir", "stat", "truncate",
    "unlink", "utimes", "watch", "writeFile",
    "accessSync", "appendFileSync", "chmodSync", "chownSync", "copyFileSync", "existsSync",
    "lchmodSync", "lchownSync", "linkSync", "lstatSync", "mkdirSync", "mkdtempSync", "openSync",
    "opendirSync", "readFileSync", "readdirSync", "readlinkSync", "realpathSync", "renameSync",
    "rmSync", "rmdirSync", "statSync", "truncateSync", "unlinkSync", "utimesSync", "watchFile",
    "writeFileSync":
    return true
  }
  return false
}

func isFSModule(module string) bool {
  return module == "fs" || module == "node:fs" || module == "fs/promises" ||
    module == "node:fs/promises" || module == "fs-extra"
}

func isChildProcessModule(module string) bool {
  return module == "child_process" || module == "node:child_process"
}

func isTrueLiteral(node *shimast.Node) bool {
  value, ok := isLiteralBoolean(stripParens(node))
  return ok && value
}

func isFalseLiteral(node *shimast.Node) bool {
  value, ok := isLiteralBoolean(stripParens(node))
  return ok && !value
}

func isEqualityOperator(kind shimast.Kind) bool {
  switch kind {
  case shimast.KindEqualsEqualsToken,
    shimast.KindEqualsEqualsEqualsToken,
    shimast.KindExclamationEqualsToken,
    shimast.KindExclamationEqualsEqualsToken:
    return true
  }
  return false
}

func containsSecretIdentifier(node *shimast.Node) bool {
  found := false
  walkDescendants(node, func(child *shimast.Node) {
    name := strings.ToLower(identifierText(child))
    if name == "" {
      return
    }
    if strings.Contains(name, "password") ||
      strings.Contains(name, "passwd") ||
      strings.Contains(name, "secret") ||
      strings.Contains(name, "token") ||
      strings.Contains(name, "apikey") ||
      strings.Contains(name, "api_key") {
      found = true
    }
  })
  return found
}

func isBidiControlRune(r rune) bool {
  switch r {
  case '\u202A', '\u202B', '\u202C', '\u202D', '\u202E', '\u2066', '\u2067', '\u2068', '\u2069':
    return true
  }
  return false
}

func regexpPatternFromLiteral(text string) string {
  if !strings.HasPrefix(text, "/") {
    return text
  }
  escaped := false
  for i := len(text) - 1; i > 0; i-- {
    if text[i] != '/' || escaped {
      escaped = text[i] == '\\' && !escaped
      continue
    }
    return text[1:i]
  }
  return text
}

func looksUnsafeRegex(pattern string) bool {
  if pattern == "" {
    return false
  }
  return strings.Contains(pattern, "+)+") ||
    strings.Contains(pattern, "*)+") ||
    strings.Contains(pattern, "+}+") ||
    strings.Contains(pattern, "*)*") ||
    strings.Contains(pattern, "(.*)+")
}

func init() {
  Register(securityDetectBidiCharacters{})
  Register(securityDetectBufferNoassert{})
  Register(securityDetectChildProcess{})
  Register(securityDetectDisableMustacheEscape{})
  Register(securityDetectEvalWithExpression{})
  Register(securityDetectNewBuffer{})
  Register(securityDetectNoCSRFBeforeMethodOverride{})
  Register(securityDetectNonLiteralFSFilename{})
  Register(securityDetectNonLiteralRegexp{})
  Register(securityDetectNonLiteralRequire{})
  Register(securityDetectObjectInjection{})
  Register(securityDetectPossibleTimingAttacks{})
  Register(securityDetectPseudoRandomBytes{})
  Register(securityDetectUnsafeRegex{})
}
