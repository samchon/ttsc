package main

import shimast "github.com/microsoft/typescript-go/shim/ast"

// no-explicit-any: ban `: any` annotations. Loud equivalent of
// `@typescript-eslint/no-explicit-any`.
type noExplicitAny struct{}

func (noExplicitAny) Name() string           { return "no-explicit-any" }
func (noExplicitAny) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindAnyKeyword} }
func (noExplicitAny) Check(ctx *Context, node *shimast.Node) {
  ctx.Report(node, "Unexpected any. Specify a different type.")
}

// no-non-null-assertion: ban the postfix `!` non-null assertion.
type noNonNullAssertion struct{}

func (noNonNullAssertion) Name() string { return "no-non-null-assertion" }
func (noNonNullAssertion) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindNonNullExpression}
}
func (noNonNullAssertion) Check(ctx *Context, node *shimast.Node) {
  ctx.Report(node, "Forbidden non-null assertion.")
}

// no-empty-interface: empty `interface { }` declarations are an alias
// for the supertype with extra ceremony.
type noEmptyInterface struct{}

func (noEmptyInterface) Name() string { return "no-empty-interface" }
func (noEmptyInterface) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindInterfaceDeclaration}
}
func (noEmptyInterface) Check(ctx *Context, node *shimast.Node) {
  decl := node.AsInterfaceDeclaration()
  if decl == nil || decl.Members == nil {
    return
  }
  if len(decl.Members.Nodes) == 0 {
    ctx.Report(node, "An empty interface is equivalent to '{}'.")
  }
}

// no-inferrable-types: `let x: number = 0` — the annotation is what TS
// would have inferred anyway.
type noInferrableTypes struct{}

func (noInferrableTypes) Name() string { return "no-inferrable-types" }
func (noInferrableTypes) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindVariableDeclaration, shimast.KindParameter, shimast.KindPropertyDeclaration}
}
func (noInferrableTypes) Check(ctx *Context, node *shimast.Node) {
  var typeNode, init *shimast.Node
  switch node.Kind {
  case shimast.KindVariableDeclaration:
    decl := node.AsVariableDeclaration()
    if decl == nil {
      return
    }
    typeNode = decl.Type
    init = decl.Initializer
  case shimast.KindParameter:
    decl := node.AsParameterDeclaration()
    if decl == nil {
      return
    }
    typeNode = decl.Type
    init = decl.Initializer
  case shimast.KindPropertyDeclaration:
    decl := node.AsPropertyDeclaration()
    if decl == nil {
      return
    }
    typeNode = decl.Type
    init = decl.Initializer
  }
  if typeNode == nil || init == nil {
    return
  }
  if !isInferrablePair(typeNode, init) {
    return
  }
  ctx.Report(typeNode, "Type annotation here is unnecessary.")
}

func isInferrablePair(typeNode, init *shimast.Node) bool {
  switch typeNode.Kind {
  case shimast.KindStringKeyword:
    return init.Kind == shimast.KindStringLiteral || init.Kind == shimast.KindNoSubstitutionTemplateLiteral || init.Kind == shimast.KindTemplateExpression
  case shimast.KindNumberKeyword:
    return init.Kind == shimast.KindNumericLiteral || isUnaryNumeric(init)
  case shimast.KindBooleanKeyword:
    return init.Kind == shimast.KindTrueKeyword || init.Kind == shimast.KindFalseKeyword
  case shimast.KindBigIntKeyword:
    return init.Kind == shimast.KindBigIntLiteral
  case shimast.KindNullKeyword:
    return init.Kind == shimast.KindNullKeyword
  case shimast.KindUndefinedKeyword:
    return identifierText(init) == "undefined" || init.Kind == shimast.KindVoidExpression
  }
  return false
}

func isUnaryNumeric(node *shimast.Node) bool {
  if node == nil || node.Kind != shimast.KindPrefixUnaryExpression {
    return false
  }
  prefix := node.AsPrefixUnaryExpression()
  if prefix == nil {
    return false
  }
  switch prefix.Operator {
  case shimast.KindPlusToken, shimast.KindMinusToken:
    return prefix.Operand != nil && prefix.Operand.Kind == shimast.KindNumericLiteral
  }
  return false
}

// no-namespace: TypeScript-only `namespace`/`module` declarations. They
// exist for legacy reasons; modern TS uses ES modules.
type noNamespace struct{}

func (noNamespace) Name() string           { return "no-namespace" }
func (noNamespace) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindModuleDeclaration} }
func (noNamespace) Check(ctx *Context, node *shimast.Node) {
  decl := node.AsModuleDeclaration()
  if decl == nil || decl.Name() == nil {
    return
  }
  // Skip `declare module "fs"` ambient module declarations — those are
  // the legitimate use case.
  if decl.Name().Kind == shimast.KindStringLiteral {
    return
  }
  ctx.Report(node, "ES2015 module syntax is preferred over namespaces.")
}

// no-this-alias: `const self = this;` reassigns `this` to a local. Use
// arrow functions or `.bind(this)` instead.
type noThisAlias struct{}

func (noThisAlias) Name() string           { return "no-this-alias" }
func (noThisAlias) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindVariableDeclaration} }
func (noThisAlias) Check(ctx *Context, node *shimast.Node) {
  decl := node.AsVariableDeclaration()
  if decl == nil || decl.Initializer == nil {
    return
  }
  if decl.Initializer.Kind == shimast.KindThisKeyword {
    ctx.Report(node, "Unexpected aliasing of 'this' to local variable.")
  }
}

// prefer-as-const: `as 'foo'` / `as 1` should be `as const`.
type preferAsConst struct{}

func (preferAsConst) Name() string { return "prefer-as-const" }
func (preferAsConst) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindAsExpression, shimast.KindTypeAssertionExpression}
}
func (preferAsConst) Check(ctx *Context, node *shimast.Node) {
  var expr, typeNode *shimast.Node
  switch node.Kind {
  case shimast.KindAsExpression:
    as := node.AsAsExpression()
    if as == nil {
      return
    }
    expr = as.Expression
    typeNode = as.Type
  case shimast.KindTypeAssertionExpression:
    ta := node.AsTypeAssertion()
    if ta == nil {
      return
    }
    expr = ta.Expression
    typeNode = ta.Type
  }
  if expr == nil || typeNode == nil {
    return
  }
  if typeNode.Kind != shimast.KindLiteralType {
    return
  }
  literalType := typeNode.AsLiteralTypeNode()
  if literalType == nil || literalType.Literal == nil {
    return
  }
  if !literalsMatchSourceText(ctx.File, expr, literalType.Literal) {
    return
  }
  ctx.Report(node, "Expected `as const` instead of `as` literal type.")
}

func literalsMatchSourceText(file *shimast.SourceFile, lhs, rhs *shimast.Node) bool {
  if lhs == nil || rhs == nil {
    return false
  }
  if !isLiteralExpression(lhs) {
    return false
  }
  return nodeText(file, lhs) == nodeText(file, rhs)
}

// no-require-imports: ban `require(...)` calls in TS source. Use
// ES `import` instead.
type noRequireImports struct{}

func (noRequireImports) Name() string { return "no-require-imports" }
func (noRequireImports) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindCallExpression, shimast.KindImportEqualsDeclaration}
}
func (noRequireImports) Check(ctx *Context, node *shimast.Node) {
  switch node.Kind {
  case shimast.KindCallExpression:
    call := node.AsCallExpression()
    if call == nil {
      return
    }
    if callCalleeName(call) != "require" {
      return
    }
    // Ignore `import("...")` — that's a different node kind.
    ctx.Report(node, "A `require()` style import is forbidden.")
  case shimast.KindImportEqualsDeclaration:
    ctx.Report(node, "An `import = require()` style import is forbidden.")
  }
}

// ban-ts-comment: `// @ts-ignore` / `// @ts-nocheck` / `// @ts-expect-error`
// silence the type checker. Default mode flags every variant.
type banTsComment struct{}

func (banTsComment) Name() string           { return "ban-ts-comment" }
func (banTsComment) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }
func (banTsComment) Check(ctx *Context, node *shimast.Node) {
  if ctx.File == nil {
    return
  }
  for _, directive := range ctx.File.CommentDirectives {
    switch directive.Kind {
    case shimast.CommentDirectiveKindIgnore:
      ctx.ReportRange(directive.Loc.Pos(), directive.Loc.End(), "Do not use `@ts-ignore` because it alters compilation errors.")
    case shimast.CommentDirectiveKindExpectError:
      ctx.ReportRange(directive.Loc.Pos(), directive.Loc.End(), "Do not use `@ts-expect-error` because it alters compilation errors.")
    }
  }
}

func init() {
  Register(noExplicitAny{})
  Register(noNonNullAssertion{})
  Register(noEmptyInterface{})
  Register(noInferrableTypes{})
  Register(noNamespace{})
  Register(noThisAlias{})
  Register(preferAsConst{})
  Register(noRequireImports{})
  Register(banTsComment{})
}
