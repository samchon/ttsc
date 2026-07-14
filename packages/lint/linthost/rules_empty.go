package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// noEmpty rejects empty block and switch statements unless an interior
// comment documents the intentional no-op.
// https://eslint.org/docs/latest/rules/no-empty
type noEmpty struct{}

type noEmptyOptions struct {
  AllowEmptyCatch bool `json:"allowEmptyCatch"`
}

func (noEmpty) Name() string           { return "no-empty" }
func (noEmpty) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindBlock, shimast.KindSwitchStatement}
}
func (noEmpty) Check(ctx *Context, node *shimast.Node) {
  if node.Kind == shimast.KindSwitchStatement {
    statement := node.AsSwitchStatement()
    if statement == nil || statement.CaseBlock == nil {
      return
    }
    caseBlock := statement.CaseBlock.AsCaseBlock()
    if caseBlock == nil || caseBlock.Clauses != nil && len(caseBlock.Clauses.Nodes) != 0 {
      return
    }
    if !emptyBracedBodyHasComment(ctx.File, statement.CaseBlock) {
      ctx.Report(statement.CaseBlock, "Empty switch statement.")
    }
    return
  }

  block := node.AsBlock()
  if block == nil || block.Statements != nil && len(block.Statements.Nodes) != 0 {
    return
  }
  parent := node.Parent
  if isFunctionLikeKind(parent) {
    return // empty function body is `no-empty-function`'s job
  }
  if parent != nil && parent.Kind == shimast.KindClassStaticBlockDeclaration {
    return // static blocks have their own rule and are not BlockStatement in ESTree
  }
  var options noEmptyOptions
  _ = ctx.DecodeOptions(&options)
  if options.AllowEmptyCatch && parent != nil && parent.Kind == shimast.KindCatchClause {
    return
  }
  if !emptyBracedBodyHasComment(ctx.File, node) {
    ctx.Report(node, "Empty block statement.")
  }
}

// noEmptyFunction: empty function / method / arrow / accessor bodies.
// https://eslint.org/docs/latest/rules/no-empty-function
type noEmptyFunction struct{}

type noEmptyFunctionOptions struct {
  Allow []string `json:"allow"`
}

func (noEmptyFunction) Name() string { return "no-empty-function" }
func (noEmptyFunction) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindFunctionDeclaration,
    shimast.KindFunctionExpression,
    shimast.KindArrowFunction,
    shimast.KindMethodDeclaration,
    shimast.KindGetAccessor,
    shimast.KindSetAccessor,
    shimast.KindConstructor,
  }
}
func (noEmptyFunction) Check(ctx *Context, node *shimast.Node) {
  body := node.Body()
  if body == nil || body.Kind != shimast.KindBlock {
    return
  }
  block := body.AsBlock()
  if block == nil || block.Statements != nil && len(block.Statements.Nodes) != 0 {
    return
  }
  var options noEmptyFunctionOptions
  _ = ctx.DecodeOptions(&options)
  kind := noEmptyFunctionKind(node)
  if kind == "" || noEmptyFunctionAllowed(node, kind, options.Allow) || emptyBracedBodyHasComment(ctx.File, body) {
    return
  }
  ctx.Report(body, "Unexpected empty "+noEmptyFunctionLabel(kind)+".")
}

func noEmptyFunctionKind(node *shimast.Node) string {
  if node == nil {
    return ""
  }
  switch node.Kind {
  case shimast.KindArrowFunction:
    return "arrowFunctions"
  case shimast.KindConstructor:
    return "constructors"
  case shimast.KindGetAccessor:
    return "getters"
  case shimast.KindSetAccessor:
    return "setters"
  case shimast.KindMethodDeclaration:
    if noEmptyFunctionIsGenerator(node) {
      return "generatorMethods"
    }
    if node.ModifierFlags()&shimast.ModifierFlagsAsync != 0 {
      return "asyncMethods"
    }
    return "methods"
  case shimast.KindFunctionDeclaration, shimast.KindFunctionExpression:
    if noEmptyFunctionIsGenerator(node) {
      return "generatorFunctions"
    }
    if node.ModifierFlags()&shimast.ModifierFlagsAsync != 0 {
      return "asyncFunctions"
    }
    return "functions"
  default:
    return ""
  }
}

func noEmptyFunctionIsGenerator(node *shimast.Node) bool {
  switch node.Kind {
  case shimast.KindFunctionDeclaration:
    declaration := node.AsFunctionDeclaration()
    return declaration != nil && declaration.AsteriskToken != nil
  case shimast.KindFunctionExpression:
    expression := node.AsFunctionExpression()
    return expression != nil && expression.AsteriskToken != nil
  case shimast.KindMethodDeclaration:
    declaration := node.AsMethodDeclaration()
    return declaration != nil && declaration.AsteriskToken != nil
  default:
    return false
  }
}

func noEmptyFunctionAllowed(node *shimast.Node, kind string, allow []string) bool {
  if noEmptyFunctionOptionIncludes(allow, kind) {
    return true
  }
  if kind == "constructors" {
    if hasParameterProperty(node) {
      return true
    }
    modifiers := node.ModifierFlags()
    if modifiers&shimast.ModifierFlagsPrivate != 0 && noEmptyFunctionOptionIncludes(allow, "privateConstructors") {
      return true
    }
    if modifiers&shimast.ModifierFlagsProtected != 0 && noEmptyFunctionOptionIncludes(allow, "protectedConstructors") {
      return true
    }
  }
  switch kind {
  case "methods", "generatorMethods", "asyncMethods", "getters", "setters":
    if len(node.Decorators()) != 0 && noEmptyFunctionOptionIncludes(allow, "decoratedFunctions") {
      return true
    }
    if node.ModifierFlags()&shimast.ModifierFlagsOverride != 0 && noEmptyFunctionOptionIncludes(allow, "overrideMethods") {
      return true
    }
  }
  return false
}

func noEmptyFunctionOptionIncludes(allow []string, candidate string) bool {
  for _, option := range allow {
    if option == candidate {
      return true
    }
  }
  return false
}

func noEmptyFunctionLabel(kind string) string {
  switch kind {
  case "arrowFunctions":
    return "arrow function"
  case "generatorFunctions":
    return "generator function"
  case "methods":
    return "method"
  case "generatorMethods":
    return "generator method"
  case "getters":
    return "getter"
  case "setters":
    return "setter"
  case "constructors":
    return "constructor"
  case "asyncFunctions":
    return "async function"
  case "asyncMethods":
    return "async method"
  default:
    return "function"
  }
}

// emptyBracedBodyHasComment scans only the trivia between the parser-owned
// opening and closing brace tokens of an already-proven empty body. Exterior
// comments cannot enter this range, and context-sensitive expression tokens
// cannot occur because the body has no statements or switch clauses.
func emptyBracedBodyHasComment(file *shimast.SourceFile, body *shimast.Node) bool {
  if file == nil || body == nil {
    return false
  }
  opening := shimscanner.GetScannerForSourceFile(file, body.Pos())
  if opening.Token() != shimast.KindOpenBraceToken || opening.TokenEnd() > body.End() {
    return false
  }
  closing := shimscanner.GetScannerForSourceFile(file, opening.TokenEnd())
  if closing.Token() != shimast.KindCloseBraceToken || closing.TokenEnd() > body.End() {
    return false
  }
  found := false
  scanCommentGap(shimscanner.NewScanner(), file.Text(), opening.TokenEnd(), closing.TokenStart(), func(_ shimast.Kind, _, _ int) {
    found = true
  })
  return found
}

// noEmptyPattern: `({}) => x` or `function ({}) {}` — destructuring
// patterns with no bindings are usually a bug.
// https://eslint.org/docs/latest/rules/no-empty-pattern
type noEmptyPattern struct{}

func (noEmptyPattern) Name() string { return "no-empty-pattern" }
func (noEmptyPattern) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindObjectBindingPattern, shimast.KindArrayBindingPattern}
}
func (noEmptyPattern) Check(ctx *Context, node *shimast.Node) {
  pattern := node.AsBindingPattern()
  if pattern == nil || pattern.Elements == nil {
    return
  }
  if len(pattern.Elements.Nodes) == 0 {
    shape := "object"
    if node.Kind == shimast.KindArrayBindingPattern {
      shape = "array"
    }
    ctx.Report(node, "Unexpected empty "+shape+" pattern.")
  }
}

// isFunctionLikeKind reports whether n represents a function-like AST node
// (declaration, expression, arrow, method, accessor, or constructor). Used
// to detect scope boundaries by rules_empty, rules_finally, and others.
func isFunctionLikeKind(n *shimast.Node) bool {
  if n == nil {
    return false
  }
  switch n.Kind {
  case
    shimast.KindFunctionDeclaration,
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

func init() {
  Register(noEmpty{})
  Register(noEmptyFunction{})
  Register(noEmptyPattern{})
}
