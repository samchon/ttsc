// unicornIsolatedFunctions ports unicorn/isolated-functions: functions that
// run outside their defining execution context (workerized callbacks,
// `page.evaluate` payloads, `@isolated`-tagged functions, selector-matched
// functions) must not reference bindings from their surrounding scope, `this`,
// or `super`.
//
// Scope escape is decided by the TypeScript-Go checker: a reference inside an
// isolated function is allowed only when its symbol has a declaration inside
// the function (parameters, locals, nested declarations). ESLint's
// language-options globals have no direct equivalent here, so the port maps
// "configured globals" to ambient global declarations (lib files, `@types`
// packages, `declare global` blocks): those stay allowed read-only, mirroring
// upstream's all-readonly ES-globals default, and the `overrideGlobals` option
// remains the writability/off escape hatch. Everything else — module and
// script bindings, imports, recursion through the function's own hoisted name,
// unresolved names — is reported exactly like upstream's `scope.through`
// analysis.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/isolated-functions.md
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

var (
  unicornIsolatedFunctionsDefaultFunctions = []string{"makeSynchronous", "workerize"}
  unicornIsolatedFunctionsDefaultComments  = []string{"@isolated"}
  // JSDoc block comments keep their `*` margin in the raw comment interior;
  // upstream strips one leading run of `*`-and-whitespace before matching.
  unicornIsolatedFunctionsCommentMarginPattern = regexp.MustCompile(`^(?:\*\s*)*`)
)

type unicornIsolatedFunctions struct{ optionsRule }

type unicornIsolatedFunctionsRawOptions struct {
  Functions       json.RawMessage `json:"functions"`
  Selectors       json.RawMessage `json:"selectors"`
  Comments        json.RawMessage `json:"comments"`
  OverrideGlobals json.RawMessage `json:"overrideGlobals"`
}

// unicornIsolatedFunctionsGlobalPolicy is one normalized overrideGlobals
// value. Upstream accepts booleans plus the writability strings; `false` and
// "readonly" both mean readable-but-not-writable, so the port collapses them.
type unicornIsolatedFunctionsGlobalPolicy uint8

const (
  unicornIsolatedFunctionsGlobalReadonly unicornIsolatedFunctionsGlobalPolicy = iota
  unicornIsolatedFunctionsGlobalWritable
  unicornIsolatedFunctionsGlobalOff
)

type unicornIsolatedFunctionsSelector struct {
  source   string
  selector *astSelector
}

type unicornIsolatedFunctionsOptions struct {
  functions       []string
  selectors       []unicornIsolatedFunctionsSelector
  comments        []string
  overrideGlobals map[string]unicornIsolatedFunctionsGlobalPolicy
}

type unicornIsolatedFunctionsProblem struct {
  pos     int
  node    *shimast.Node
  message string
}

type unicornIsolatedFunctionsAnalysis struct {
  ctx      *Context
  options  unicornIsolatedFunctionsOptions
  factory  *shimast.NodeFactory
  selected []map[*shimast.Node]struct{}
  problems []unicornIsolatedFunctionsProblem
  walkCB   func(*shimast.Node) bool
}

func (unicornIsolatedFunctions) Name() string { return "unicorn/isolated-functions" }

// NeedsTypeChecker: scope escape is decided with checker symbol resolution so
// shadowing, destructuring, hoisting, and TypeScript declarations keep their
// real binding identity instead of a name-only approximation.
func (unicornIsolatedFunctions) NeedsTypeChecker() bool { return true }

func (unicornIsolatedFunctions) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}

// ValidateOptions is consumed by the engine's optional rule-options
// validation interface. Parsing here makes malformed selectors and
// overrideGlobals values a project configuration error before any file is
// linted.
func (unicornIsolatedFunctions) ValidateOptions(raw json.RawMessage) error {
  _, err := compileUnicornIsolatedFunctionsOptions(raw)
  return err
}

func (unicornIsolatedFunctions) Check(ctx *Context, root *shimast.Node) {
  if ctx == nil || ctx.File == nil || ctx.Checker == nil || root == nil {
    return
  }
  options, err := compileUnicornIsolatedFunctionsOptions(ctx.Options)
  if err != nil {
    // Engine construction already records this as a configuration error.
    // Check stays side-effect-free for direct contributor calls.
    return
  }

  analysis := &unicornIsolatedFunctionsAnalysis{
    ctx:     ctx,
    options: options,
    factory: shimast.NewNodeFactory(shimast.NodeFactoryHooks{}),
  }
  analysis.selected = make([]map[*shimast.Node]struct{}, len(options.selectors))
  for index, entry := range options.selectors {
    matched := matchASTSelector(root, entry.selector)
    set := make(map[*shimast.Node]struct{}, len(matched))
    for _, node := range matched {
      set[node] = struct{}{}
    }
    analysis.selected[index] = set
  }

  analysis.walkCB = analysis.visit
  analysis.walk(root)

  // ESLint sorts the final diagnostics by source position. The stable sort
  // preserves the upstream inner-before-outer report order when nested
  // isolated functions flag the same identifier.
  sort.SliceStable(analysis.problems, func(left, right int) bool {
    return analysis.problems[left].pos < analysis.problems[right].pos
  })
  for _, problem := range analysis.problems {
    ctx.Report(problem.node, problem.message)
  }
}

// walk processes functions on exit (children first), matching upstream's
// `context.onExit` registration: nested isolated functions report before the
// enclosing one.
func (a *unicornIsolatedFunctionsAnalysis) walk(node *shimast.Node) {
  if node == nil {
    return
  }
  node.ForEachChild(a.walkCB)
  if unicornIsolatedFunctionsIsFunction(node) {
    if reason := a.isolationReason(node); reason != "" {
      a.analyzeFunction(node, reason)
    }
  }
}

func (a *unicornIsolatedFunctionsAnalysis) visit(child *shimast.Node) bool {
  a.walk(child)
  return false
}

// unicornIsolatedFunctionsIsFunction lists the function shapes a reason can
// attach to. Upstream's ESTree function types are declaration, expression, and
// arrow; TypeScript-Go represents class/object methods, accessors, and
// constructors as their own function nodes (ESTree wraps a FunctionExpression
// value), so those participate directly.
func unicornIsolatedFunctionsIsFunction(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindFunctionDeclaration,
    shimast.KindFunctionExpression,
    shimast.KindArrowFunction,
    shimast.KindMethodDeclaration,
    shimast.KindGetAccessor,
    shimast.KindSetAccessor,
    shimast.KindConstructor:
    return true
  }
  return false
}

// isolationReason mirrors upstream's reasonForBeingIsolatedFunction plus its
// selector listeners: comment markers win, then the `functions` option, then
// the built-in browser.execute/page.evaluate/executeScript shapes, then the
// configured selectors in option order. The first reason claims the function;
// upstream's `checked` set never lets a second listener re-report it.
func (a *unicornIsolatedFunctionsAnalysis) isolationReason(node *shimast.Node) string {
  if len(a.options.comments) > 0 {
    if interior, ok := a.findIsolationComment(node); ok {
      value := unicornIsolatedFunctionsCommentMarginPattern.ReplaceAllString(interior, "")
      value = strings.ToLower(strings.TrimSpace(value))
      for _, comment := range a.options.comments {
        if value == comment ||
          strings.HasPrefix(value, comment+" - ") ||
          strings.HasPrefix(value, comment+" -- ") {
          return "follows comment " + unicornIsolatedFunctionsQuote(comment)
        }
      }
    }
  }
  if reason := a.callArgumentReason(node); reason != "" {
    return reason
  }
  for index, entry := range a.options.selectors {
    if _, ok := a.selected[index][node]; ok {
      return "matches selector " + unicornIsolatedFunctionsQuote(entry.source)
    }
  }
  return ""
}

// callArgumentReason covers the call-shaped reasons: any argument of a
// configured function name, the first argument of `browser.execute` /
// `page.evaluate`, and the `func` property of an object passed first to
// `chrome.scripting.executeScript` / `browser.scripting.executeScript`.
// Parentheses are transparent because ESTree drops them.
func (a *unicornIsolatedFunctionsAnalysis) callArgumentReason(node *shimast.Node) string {
  parent := unicornIsolatedFunctionsParent(node)
  if parent != nil && parent.Kind == shimast.KindCallExpression {
    call := parent.AsCallExpression()
    if call != nil && call.Arguments != nil {
      isArgument := false
      isFirstArgument := false
      for index, argument := range call.Arguments.Nodes {
        if stripParens(argument) == node {
          isArgument = true
          isFirstArgument = index == 0
          break
        }
      }
      if isArgument && len(a.options.functions) > 0 {
        if name := identifierText(stripParens(call.Expression)); name != "" {
          for _, function := range a.options.functions {
            if function == name {
              return "callee of function named " + unicornIsolatedFunctionsQuote(name)
            }
          }
        }
      }
      if isFirstArgument {
        switch unicornIsolatedFunctionsMethodObjectName(call, "execute") {
        case "browser":
          return `callee of method named "browser.execute"`
        }
        switch unicornIsolatedFunctionsMethodObjectName(call, "evaluate") {
        case "page":
          return `callee of method named "page.evaluate"`
        }
      }
    }
  }
  return a.executeScriptFuncReason(node)
}

// unicornIsolatedFunctionsMethodObjectName returns the simple-identifier
// receiver of a non-computed `object.method(...)` call, or "" when the callee
// has any other shape. Optional chaining is accepted, mirroring upstream's
// unconstrained isMethodCall options.
func unicornIsolatedFunctionsMethodObjectName(call *shimast.CallExpression, method string) string {
  if call == nil {
    return ""
  }
  callee := stripParens(call.Expression)
  if callee == nil || callee.Kind != shimast.KindPropertyAccessExpression {
    return ""
  }
  access := callee.AsPropertyAccessExpression()
  if access == nil || identifierText(access.Name()) != method {
    return ""
  }
  return identifierText(stripParens(access.Expression))
}

// executeScriptFuncReason recognizes `func`-valued properties (assignment,
// string key, computed string key, or method shorthand — upstream Property
// kind "init") on an object literal passed as the first argument of
// `<browser|chrome>.scripting.executeScript(...)`. Accessors stay excluded.
func (a *unicornIsolatedFunctionsAnalysis) executeScriptFuncReason(node *shimast.Node) string {
  var property *shimast.Node
  switch node.Kind {
  case shimast.KindMethodDeclaration:
    property = node
  case shimast.KindFunctionExpression, shimast.KindArrowFunction:
    parent := unicornIsolatedFunctionsParent(node)
    if parent == nil || parent.Kind != shimast.KindPropertyAssignment {
      return ""
    }
    assignment := parent.AsPropertyAssignment()
    if assignment == nil || stripParens(assignment.Initializer) != node {
      return ""
    }
    property = parent
  default:
    return ""
  }
  if unicornIsolatedFunctionsObjectPropertyName(property.Name()) != "func" {
    return ""
  }
  object := property.Parent
  if object == nil || object.Kind != shimast.KindObjectLiteralExpression {
    return ""
  }
  callNode := unicornIsolatedFunctionsParent(object)
  if callNode == nil || callNode.Kind != shimast.KindCallExpression {
    return ""
  }
  call := callNode.AsCallExpression()
  if call == nil || call.Arguments == nil || len(call.Arguments.Nodes) == 0 ||
    stripParens(call.Arguments.Nodes[0]) != object {
    return ""
  }
  scripting := unicornIsolatedFunctionsMethodObjectAccess(call, "executeScript")
  if scripting == nil || scripting.Kind != shimast.KindPropertyAccessExpression {
    return ""
  }
  access := scripting.AsPropertyAccessExpression()
  if access == nil || identifierText(access.Name()) != "scripting" {
    return ""
  }
  base := identifierText(stripParens(access.Expression))
  if base != "browser" && base != "chrome" {
    return ""
  }
  return `property "func" passed to "` + base + `.scripting.executeScript"`
}

// unicornIsolatedFunctionsMethodObjectAccess returns the receiver expression
// of a non-computed `receiver.method(...)` call without constraining the
// receiver's shape.
func unicornIsolatedFunctionsMethodObjectAccess(call *shimast.CallExpression, method string) *shimast.Node {
  if call == nil {
    return nil
  }
  callee := stripParens(call.Expression)
  if callee == nil || callee.Kind != shimast.KindPropertyAccessExpression {
    return nil
  }
  access := callee.AsPropertyAccessExpression()
  if access == nil || identifierText(access.Name()) != method {
    return nil
  }
  return stripParens(access.Expression)
}

// unicornIsolatedFunctionsObjectPropertyName mirrors upstream's
// getObjectPropertyName: identifier keys and string-literal keys count, and a
// computed key counts only when it is a string literal.
func unicornIsolatedFunctionsObjectPropertyName(name *shimast.Node) string {
  if name == nil {
    return ""
  }
  switch name.Kind {
  case shimast.KindIdentifier:
    return identifierText(name)
  case shimast.KindStringLiteral:
    return stringLiteralText(name)
  case shimast.KindComputedPropertyName:
    computed := name.AsComputedPropertyName()
    if computed == nil {
      return ""
    }
    expression := stripParens(computed.Expression)
    if expression != nil && expression.Kind == shimast.KindStringLiteral {
      return stringLiteralText(expression)
    }
  }
  return ""
}

// unicornIsolatedFunctionsParent returns the ESTree-equivalent parent:
// TypeScript-Go keeps ParenthesizedExpression nodes that ESLint's tree drops.
func unicornIsolatedFunctionsParent(node *shimast.Node) *shimast.Node {
  if node == nil {
    return nil
  }
  parent := node.Parent
  for parent != nil && parent.Kind == shimast.KindParenthesizedExpression {
    parent = parent.Parent
  }
  return parent
}

// findIsolationComment mirrors upstream's findComment: take the comment
// directly preceding the function, walking up through variable, export, and
// property declarations while no comment has been found yet. The first
// comment encountered ends the walk whether or not it matches.
func (a *unicornIsolatedFunctionsAnalysis) findIsolationComment(node *shimast.Node) (string, bool) {
  commentable := node
  for {
    if interior, ok := a.lastLeadingComment(commentable); ok {
      return interior, true
    }
    next := unicornIsolatedFunctionsCommentParent(commentable)
    if next == nil {
      return "", false
    }
    commentable = next
  }
}

// unicornIsolatedFunctionsCommentParent maps upstream's
// canCommentApplyToParent chain onto the TypeScript-Go tree. ESTree's
// VariableDeclarator/VariableDeclaration/ExportNamedDeclaration hops become
// VariableDeclaration/VariableDeclarationList/VariableStatement (export
// modifiers live on the statement); ExportDefaultDeclaration is
// ExportAssignment; Property values hop to their PropertyAssignment. Class
// and object methods carry their own leading trivia, so they need no hop.
func unicornIsolatedFunctionsCommentParent(node *shimast.Node) *shimast.Node {
  if node == nil {
    return nil
  }
  wrapped := node
  parent := node.Parent
  for parent != nil && parent.Kind == shimast.KindParenthesizedExpression {
    wrapped = parent
    parent = parent.Parent
  }
  if parent == nil {
    return nil
  }
  switch parent.Kind {
  case shimast.KindVariableDeclaration,
    shimast.KindVariableDeclarationList,
    shimast.KindVariableStatement:
    return parent
  case shimast.KindExportAssignment:
    assignment := parent.AsExportAssignment()
    // `export = fn` is TSExportAssignment upstream, which is not in the
    // comment-walk allowlist; only `export default` hops.
    if assignment != nil && !assignment.IsExportEquals {
      return parent
    }
  case shimast.KindPropertyAssignment:
    assignment := parent.AsPropertyAssignment()
    if assignment != nil && assignment.Initializer == wrapped {
      return parent
    }
  }
  return nil
}

// lastLeadingComment returns the interior text of the last comment inside the
// node's leading trivia. That comment is exactly what ESLint's
// getTokenBefore(node, {includeComments: true}) yields when the preceding
// token is a comment: no other token can sit between it and the node.
func (a *unicornIsolatedFunctionsAnalysis) lastLeadingComment(node *shimast.Node) (string, bool) {
  if a.ctx.File == nil || node == nil {
    return "", false
  }
  source := a.ctx.File.Text()
  triviaStart := node.Pos()
  if triviaStart < 0 || triviaStart > len(source) {
    return "", false
  }
  tokenStart := shimscanner.SkipTrivia(source, triviaStart)
  if tokenStart <= triviaStart || tokenStart > len(source) {
    return "", false
  }
  var last shimast.CommentRange
  found := false
  consider := func(comment shimast.CommentRange) {
    if comment.Pos() < triviaStart || comment.End() > tokenStart {
      return
    }
    if !found || comment.End() > last.End() {
      last = comment
      found = true
    }
  }
  for comment := range shimscanner.GetTrailingCommentRanges(a.factory, source, triviaStart) {
    consider(comment)
  }
  for comment := range shimscanner.GetLeadingCommentRanges(a.factory, source, triviaStart) {
    consider(comment)
  }
  if !found {
    return "", false
  }
  pos, end := last.Pos(), last.End()
  if pos+2 > end || end > len(source) {
    return "", false
  }
  if last.Kind == shimast.KindMultiLineCommentTrivia {
    if pos+4 > end {
      return "", false
    }
    return source[pos+2 : end-2], true
  }
  return source[pos+2 : end], true
}

// analyzeFunction reports every scope-escaping reference and every `this` /
// `super` usage of one isolated function. The walk roots are the function's
// type parameters, parameters, return type, and body: a method's name
// (computed key) and decorators evaluate in the enclosing class scope, so
// they are not part of the isolated scope, mirroring ESTree where they belong
// to the MethodDefinition wrapper.
func (a *unicornIsolatedFunctionsAnalysis) analyzeFunction(function *shimast.Node, reason string) {
  data := function.FunctionLikeData()
  if data == nil {
    return
  }
  roots := make([]*shimast.Node, 0, 8)
  if data.TypeParameters != nil {
    roots = append(roots, data.TypeParameters.Nodes...)
  }
  if data.Parameters != nil {
    roots = append(roots, data.Parameters.Nodes...)
  }
  if data.Type != nil {
    roots = append(roots, data.Type)
  }
  if body := function.Body(); body != nil {
    roots = append(roots, body)
  }

  declarations := make(map[*shimast.Node]struct{})
  writes := make(map[*shimast.Node]struct{})
  for _, root := range roots {
    walkDescendants(root, func(node *shimast.Node) {
      if node.Kind != shimast.KindShorthandPropertyAssignment {
        for _, identifier := range noLoopFuncNamedIdentifiers(node.Name()) {
          declarations[identifier] = struct{}{}
        }
      }
      for _, identifier := range writeTargetIdentifiers(node) {
        writes[identifier] = struct{}{}
      }
    })
  }
  for _, root := range roots {
    walkDescendants(root, func(node *shimast.Node) {
      if node.Kind != shimast.KindIdentifier {
        return
      }
      if _, declaration := declarations[node]; declaration {
        return
      }
      if !unicornIsolatedFunctionsIsReference(node) {
        return
      }
      a.checkReference(function, node, reason, writes)
    })
  }
  for _, root := range roots {
    a.contextWalk(root, reason)
  }
}

// unicornIsolatedFunctionsIsReference filters identifiers down to runtime (or
// upstream-visible type) references. Identifiers directly inside a type
// reference or type query mirror upstream's TSTypeReference/TSTypeQuery skip;
// qualified names below them intentionally stay visible, matching upstream.
func unicornIsolatedFunctionsIsReference(node *shimast.Node) bool {
  if !isValueReferenceIdentifier(node) {
    return false
  }
  // TypeScript-Go models the `this` at the head of a type-query entity name
  // (`typeof this.foo`) as an identifier named "this"; ESTree models every
  // `this` as a ThisExpression, which is never a scope reference. `this` is
  // reserved and can name no binding, so any identifier spelled "this" is that
  // pseudo-identifier, owned by the `this`/`super` context walk. Leaving it
  // here would double-report it as an externally-scoped variable.
  if identifierText(node) == "this" {
    return false
  }
  parent := node.Parent
  if parent == nil {
    return true
  }
  switch parent.Kind {
  case shimast.KindMetaProperty:
    // `import.meta` / `new.target` carry no scope reference.
    return false
  case shimast.KindTypeReference, shimast.KindTypeQuery:
    return false
  case shimast.KindBindingElement:
    binding := parent.AsBindingElement()
    if binding != nil && binding.PropertyName == node {
      return false
    }
  }
  return true
}

// checkReference decides one reference the way upstream walks
// `scope.through` + getAllowedGlobalValue: bindings declared inside the
// function are fine; ambient globals are readable (writable only through
// overrideGlobals); captured outer bindings and unresolved names are
// reported. A function's own hoisted name lives in the enclosing scope, so
// recursion is reported, exactly like upstream.
func (a *unicornIsolatedFunctionsAnalysis) checkReference(
  function *shimast.Node,
  identifier *shimast.Node,
  reason string,
  writes map[*shimast.Node]struct{},
) {
  name := identifierText(identifier)
  if name == "" {
    return
  }

  var symbol *shimast.Symbol
  capturedArguments := false
  if name == "arguments" {
    // The checker's `arguments` symbol has no declarations, so locate its
    // owning non-arrow function syntactically: inside the isolated function
    // it is a local; outside it is a captured binding that overrideGlobals
    // must not whitelist; without any owner it is an unresolved name.
    for ancestor := identifier.Parent; ancestor != nil; ancestor = ancestor.Parent {
      if !isFunctionLikeKind(ancestor) || ancestor.Kind == shimast.KindArrowFunction {
        continue
      }
      if ancestor.Pos() >= function.Pos() && ancestor.End() <= function.End() {
        return
      }
      capturedArguments = true
      break
    }
  } else {
    symbol = canonicalValueSymbol(a.ctx, identifier)
    if symbol != nil {
      for _, declaration := range symbol.Declarations {
        if declaration != nil && declaration != function &&
          declaration.Pos() >= function.Pos() && declaration.End() <= function.End() {
          return
        }
      }
    }
  }

  global := symbol != nil && unicornIsolatedFunctionsIsAmbientGlobal(a.ctx, name, symbol)
  captured := capturedArguments || (symbol != nil && !global)

  problemReason := reason
  policy, hasOverride := a.options.overrideGlobals[name]
  allowed := false
  if hasOverride {
    if policy != unicornIsolatedFunctionsGlobalOff && !captured {
      allowed = true
    }
  } else if global {
    policy = unicornIsolatedFunctionsGlobalReadonly
    allowed = true
  }
  if allowed {
    if _, written := writes[identifier]; !written {
      return
    }
    if policy == unicornIsolatedFunctionsGlobalWritable {
      return
    }
    problemReason += " (global variable is not writable)"
  }

  a.addProblem(identifier,
    "Variable "+name+" not defined in scope of isolated function. Function is isolated because: "+problemReason+".")
}

// unicornIsolatedFunctionsIsAmbientGlobal reports whether the symbol is this
// engine's equivalent of an ESLint configured global: every declaration is
// ambient (lib/@types declaration files or `declare` contexts) and the name
// resolves in the checker's global scope. Intrinsics such as `undefined` and
// `globalThis` have no declarations and count as globals. Script-file
// top-level bindings resolve globally but are real source declarations, so
// they stay reported like upstream's script-mode captures.
func unicornIsolatedFunctionsIsAmbientGlobal(ctx *Context, name string, symbol *shimast.Symbol) bool {
  if len(symbol.Declarations) == 0 {
    return true
  }
  for _, declaration := range symbol.Declarations {
    if declaration == nil {
      return false
    }
    if declaration.Flags&shimast.NodeFlagsAmbient != 0 {
      continue
    }
    file := shimast.GetSourceFileOfNode(declaration)
    if file == nil || !file.IsDeclarationFile {
      return false
    }
  }
  meaning := shimast.SymbolFlagsValue | shimast.SymbolFlagsType |
    shimast.SymbolFlagsNamespace | shimast.SymbolFlagsAlias
  global := ctx.Checker.ResolveName(name, nil, meaning, false /*excludeGlobals*/)
  if global == nil {
    return false
  }
  return ctx.Checker.GetMergedSymbol(global) == symbol
}

// contextWalk reports `this` and `super` usage the way upstream's
// getFunctionContextProblems does: nested non-arrow functions own their
// context and stop the walk (their computed keys still evaluate outside, so
// those are walked); nested classes contribute only their `extends`
// expression and computed member keys. A `typeof this` type query is reported
// as `this` because the upstream TS tree models it as a ThisExpression.
func (a *unicornIsolatedFunctionsAnalysis) contextWalk(node *shimast.Node, reason string) {
  if node == nil {
    return
  }
  switch node.Kind {
  case shimast.KindThisKeyword:
    a.addProblem(node, "Unexpected `this` in isolated function. Function is isolated because: "+reason+".")
    return
  case shimast.KindSuperKeyword:
    a.addProblem(node, "Unexpected `super` in isolated function. Function is isolated because: "+reason+".")
    return
  case shimast.KindClassDeclaration, shimast.KindClassExpression:
    a.contextWalk(unicornIsolatedFunctionsExtendsExpression(node), reason)
    for _, member := range unicornIsolatedFunctionsClassMembers(node) {
      if name := member.Name(); name != nil && name.Kind == shimast.KindComputedPropertyName {
        a.contextWalk(name, reason)
      }
    }
    return
  case shimast.KindTypeQuery:
    query := node.AsTypeQueryNode()
    if query != nil {
      if thisName := unicornIsolatedFunctionsEntityHead(query.ExprName); thisName != nil &&
        identifierText(thisName) == "this" {
        a.addProblem(thisName, "Unexpected `this` in isolated function. Function is isolated because: "+reason+".")
      }
    }
  }
  if isFunctionLikeKind(node) && node.Kind != shimast.KindArrowFunction {
    if name := node.Name(); name != nil && name.Kind == shimast.KindComputedPropertyName {
      a.contextWalk(name, reason)
    }
    return
  }
  node.ForEachChild(func(child *shimast.Node) bool {
    a.contextWalk(child, reason)
    return false
  })
}

// unicornIsolatedFunctionsExtendsExpression returns the runtime `extends`
// expression of a class, or nil. Type arguments and `implements` clauses are
// type-only and stay out of the context walk, mirroring upstream's superClass
// handling.
func unicornIsolatedFunctionsExtendsExpression(class *shimast.Node) *shimast.Node {
  var clauses *shimast.NodeList
  switch class.Kind {
  case shimast.KindClassDeclaration:
    declaration := class.AsClassDeclaration()
    if declaration != nil {
      clauses = declaration.HeritageClauses
    }
  case shimast.KindClassExpression:
    expression := class.AsClassExpression()
    if expression != nil {
      clauses = expression.HeritageClauses
    }
  }
  if clauses == nil {
    return nil
  }
  for _, clause := range clauses.Nodes {
    heritage := clause.AsHeritageClause()
    if heritage == nil || heritage.Token != shimast.KindExtendsKeyword ||
      heritage.Types == nil || len(heritage.Types.Nodes) == 0 {
      continue
    }
    withArguments := heritage.Types.Nodes[0].AsExpressionWithTypeArguments()
    if withArguments != nil {
      return withArguments.Expression
    }
  }
  return nil
}

func unicornIsolatedFunctionsClassMembers(class *shimast.Node) []*shimast.Node {
  switch class.Kind {
  case shimast.KindClassDeclaration:
    declaration := class.AsClassDeclaration()
    if declaration != nil && declaration.Members != nil {
      return declaration.Members.Nodes
    }
  case shimast.KindClassExpression:
    expression := class.AsClassExpression()
    if expression != nil && expression.Members != nil {
      return expression.Members.Nodes
    }
  }
  return nil
}

// unicornIsolatedFunctionsEntityHead returns the leftmost identifier of a
// type-query entity name (`typeof a.b.c` → `a`).
func unicornIsolatedFunctionsEntityHead(entity *shimast.Node) *shimast.Node {
  for entity != nil && entity.Kind == shimast.KindQualifiedName {
    qualified := entity.AsQualifiedName()
    if qualified == nil {
      return nil
    }
    entity = qualified.Left
  }
  if entity != nil && entity.Kind == shimast.KindIdentifier {
    return entity
  }
  return nil
}

func (a *unicornIsolatedFunctionsAnalysis) addProblem(node *shimast.Node, message string) {
  pos := node.Pos()
  if a.ctx.File != nil {
    pos = shimscanner.SkipTrivia(a.ctx.File.Text(), pos)
  }
  a.problems = append(a.problems, unicornIsolatedFunctionsProblem{
    pos:     pos,
    node:    node,
    message: message,
  })
}

// unicornIsolatedFunctionsQuote is JSON.stringify for reason interpolation:
// like upstream, names, comments, and selectors appear JSON-quoted, and HTML
// characters (selector combinators like `>`) stay literal.
func unicornIsolatedFunctionsQuote(value string) string {
  var buffer bytes.Buffer
  encoder := json.NewEncoder(&buffer)
  encoder.SetEscapeHTML(false)
  if err := encoder.Encode(value); err != nil {
    return strconv.Quote(value)
  }
  return strings.TrimSuffix(buffer.String(), "\n")
}

func compileUnicornIsolatedFunctionsOptions(raw json.RawMessage) (unicornIsolatedFunctionsOptions, error) {
  options := unicornIsolatedFunctionsOptions{
    functions: append([]string(nil), unicornIsolatedFunctionsDefaultFunctions...),
    comments:  append([]string(nil), unicornIsolatedFunctionsDefaultComments...),
  }
  raw = bytes.TrimSpace(raw)
  if len(raw) == 0 || bytes.Equal(raw, []byte("null")) {
    return options, nil
  }
  if raw[0] != '{' {
    return unicornIsolatedFunctionsOptions{}, fmt.Errorf("unicorn/isolated-functions options must be an object")
  }
  encoded := unicornIsolatedFunctionsRawOptions{}
  if err := decodeStrictJSON(raw, &encoded); err != nil {
    return unicornIsolatedFunctionsOptions{}, fmt.Errorf(
      "unicorn/isolated-functions options must contain only functions, selectors, comments, and overrideGlobals: %w", err)
  }

  var err error
  if options.functions, err = decodeUnicornIsolatedFunctionsStrings(
    "functions", encoded.Functions, options.functions); err != nil {
    return unicornIsolatedFunctionsOptions{}, err
  }
  if options.comments, err = decodeUnicornIsolatedFunctionsStrings(
    "comments", encoded.Comments, options.comments); err != nil {
    return unicornIsolatedFunctionsOptions{}, err
  }
  selectorSources, err := decodeUnicornIsolatedFunctionsStrings("selectors", encoded.Selectors, nil)
  if err != nil {
    return unicornIsolatedFunctionsOptions{}, err
  }
  options.selectors = make([]unicornIsolatedFunctionsSelector, 0, len(selectorSources))
  for index, source := range selectorSources {
    selector, err := parseASTSelector(source)
    if err != nil {
      return unicornIsolatedFunctionsOptions{}, fmt.Errorf(
        "unicorn/isolated-functions selector %d %q is invalid: %w", index+1, source, err)
    }
    options.selectors = append(options.selectors, unicornIsolatedFunctionsSelector{
      source:   source,
      selector: selector,
    })
  }
  for index := range options.comments {
    options.comments[index] = strings.ToLower(options.comments[index])
  }

  if trimmed := bytes.TrimSpace(encoded.OverrideGlobals); len(trimmed) > 0 && !bytes.Equal(trimmed, []byte("null")) {
    if trimmed[0] != '{' {
      return unicornIsolatedFunctionsOptions{}, fmt.Errorf(
        "unicorn/isolated-functions overrideGlobals must be an object")
    }
    entries := map[string]json.RawMessage{}
    if err := decodeStrictJSON(trimmed, &entries); err != nil {
      return unicornIsolatedFunctionsOptions{}, fmt.Errorf(
        "unicorn/isolated-functions overrideGlobals must map names to boolean, \"readonly\", \"writable\", \"writeable\", or \"off\": %w", err)
    }
    options.overrideGlobals = make(map[string]unicornIsolatedFunctionsGlobalPolicy, len(entries))
    for name, value := range entries {
      policy, err := decodeUnicornIsolatedFunctionsGlobalPolicy(name, value)
      if err != nil {
        return unicornIsolatedFunctionsOptions{}, err
      }
      options.overrideGlobals[name] = policy
    }
  }
  return options, nil
}

func decodeUnicornIsolatedFunctionsStrings(name string, raw json.RawMessage, defaults []string) ([]string, error) {
  raw = bytes.TrimSpace(raw)
  if len(raw) == 0 || bytes.Equal(raw, []byte("null")) {
    return defaults, nil
  }
  if raw[0] != '[' {
    return nil, fmt.Errorf("unicorn/isolated-functions %s must be an array of unique strings", name)
  }
  var values []string
  if err := decodeStrictJSON(raw, &values); err != nil {
    return nil, fmt.Errorf("unicorn/isolated-functions %s must be an array of unique strings: %w", name, err)
  }
  seen := make(map[string]struct{}, len(values))
  for _, value := range values {
    if _, duplicate := seen[value]; duplicate {
      return nil, fmt.Errorf("unicorn/isolated-functions %s must not contain duplicate %q", name, value)
    }
    seen[value] = struct{}{}
  }
  return values, nil
}

func decodeUnicornIsolatedFunctionsGlobalPolicy(
  name string,
  raw json.RawMessage,
) (unicornIsolatedFunctionsGlobalPolicy, error) {
  value := string(bytes.TrimSpace(raw))
  switch value {
  case "true", `"writable"`, `"writeable"`:
    return unicornIsolatedFunctionsGlobalWritable, nil
  case "false", `"readonly"`:
    return unicornIsolatedFunctionsGlobalReadonly, nil
  case `"off"`:
    return unicornIsolatedFunctionsGlobalOff, nil
  }
  return unicornIsolatedFunctionsGlobalReadonly, fmt.Errorf(
    "unicorn/isolated-functions overrideGlobals[%q] must be a boolean, \"readonly\", \"writable\", \"writeable\", or \"off\"", name)
}

func init() {
  Register(unicornIsolatedFunctions{})
}
