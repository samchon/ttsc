// Miscellaneous AST-only rules that cover the gap between the core ESLint
// "Possible Problems" list and the @typescript-eslint strict/stylistic
// presets: empty static blocks, setter returns, unused labels, dynamic
// delete, nullish-coalescing with non-null assertions, unnecessary type
// constraints, unsafe built-in types, wrapper object types, useless
// constructors, non-literal enum members, type-assertion style, type
// definition style, dot notation, and unsafe declaration merging.
// Each rule is registered in init() at the bottom of the file.
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// noEmptyStaticBlock: `class C { static {} }` has no effect.
// ESLint recommended: https://eslint.org/docs/latest/rules/no-empty-static-block
type noEmptyStaticBlock struct{}

func (noEmptyStaticBlock) Name() string { return "no-empty-static-block" }
func (noEmptyStaticBlock) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindClassStaticBlockDeclaration}
}
func (noEmptyStaticBlock) Check(ctx *Context, node *shimast.Node) {
  block := node.AsClassStaticBlockDeclaration()
  if block == nil || block.Body == nil {
    return
  }
  body := block.Body.AsBlock()
  if body == nil || body.Statements == nil || len(body.Statements.Nodes) == 0 {
    ctx.Report(node, "Unexpected empty static block.")
  }
}

// noSetterReturn: setters must not return a value.
// ESLint recommended: https://eslint.org/docs/latest/rules/no-setter-return
type noSetterReturn struct{}

func (noSetterReturn) Name() string           { return "no-setter-return" }
func (noSetterReturn) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindReturnStatement} }
func (noSetterReturn) Check(ctx *Context, node *shimast.Node) {
  ret := node.AsReturnStatement()
  if ret == nil || ret.Expression == nil || !isInsideDirectSetter(node) {
    return
  }
  ctx.Report(node, "Setter should not return a value.")
}

// isInsideDirectSetter reports whether node is lexically nested inside a
// SetAccessor without an intervening function boundary. "Direct" means the
// return value would actually be a setter return, not a nested callback's.
func isInsideDirectSetter(node *shimast.Node) bool {
  for p := node.Parent; p != nil; p = p.Parent {
    if p.Kind == shimast.KindSetAccessor {
      return true
    }
    if isFunctionLikeKind(p) {
      return false
    }
  }
  return false
}

// noUnusedLabels: a label is useful only when a break/continue targets it.
// ESLint recommended: https://eslint.org/docs/latest/rules/no-unused-labels
type noUnusedLabels struct{}

func (noUnusedLabels) Name() string           { return "no-unused-labels" }
func (noUnusedLabels) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindLabeledStatement} }
func (noUnusedLabels) Check(ctx *Context, node *shimast.Node) {
  stmt := node.AsLabeledStatement()
  if stmt == nil || stmt.Label == nil {
    return
  }
  label := identifierText(stmt.Label)
  if label == "" {
    return
  }
  used := false
  walkDescendants(stmt.Statement, func(child *shimast.Node) {
    if used || child == nil {
      return
    }
    switch child.Kind {
    case shimast.KindBreakStatement:
      br := child.AsBreakStatement()
      used = br != nil && identifierText(br.Label) == label
    case shimast.KindContinueStatement:
      cont := child.AsContinueStatement()
      used = cont != nil && identifierText(cont.Label) == label
    }
  })
  if !used {
    ctx.Report(stmt.Label, "Label '"+label+"' is defined but never used.")
  }
}

// noDynamicDelete: avoid deleting properties through dynamic keys.
// typescript-eslint strict: https://typescript-eslint.io/rules/no-dynamic-delete/
type noDynamicDelete struct{}

func (noDynamicDelete) Name() string           { return "no-dynamic-delete" }
func (noDynamicDelete) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindDeleteExpression} }
func (noDynamicDelete) Check(ctx *Context, node *shimast.Node) {
  del := node.AsDeleteExpression()
  if del == nil || del.Expression == nil || del.Expression.Kind != shimast.KindElementAccessExpression {
    return
  }
  access := del.Expression.AsElementAccessExpression()
  if access == nil || isStaticPropertyKey(access.ArgumentExpression) {
    return
  }
  ctx.Report(node, "Do not delete dynamically computed property keys.")
}

// isStaticPropertyKey reports whether node is a literal key that can
// appear in a delete expression without triggering noDynamicDelete:
// string literals, no-substitution template literals, and numeric literals.
func isStaticPropertyKey(node *shimast.Node) bool {
  node = stripParens(node)
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindStringLiteral,
    shimast.KindNoSubstitutionTemplateLiteral,
    shimast.KindNumericLiteral:
    return true
  }
  return false
}

// noNonNullAssertedNullishCoalescing: `foo! ?? bar` is contradictory.
// typescript-eslint strict: https://typescript-eslint.io/rules/no-non-null-asserted-nullish-coalescing/
type noNonNullAssertedNullishCoalescing struct{}

func (noNonNullAssertedNullishCoalescing) Name() string {
  return "no-non-null-asserted-nullish-coalescing"
}
func (noNonNullAssertedNullishCoalescing) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindBinaryExpression}
}
func (noNonNullAssertedNullishCoalescing) Check(ctx *Context, node *shimast.Node) {
  expr := node.AsBinaryExpression()
  if expr == nil || expr.OperatorToken == nil || expr.OperatorToken.Kind != shimast.KindQuestionQuestionToken {
    return
  }
  if left := stripParens(expr.Left); left != nil && left.Kind == shimast.KindNonNullExpression {
    ctx.Report(left, "Nullish coalescing is unnecessary after a non-null assertion.")
  }
  if right := stripParens(expr.Right); right != nil && right.Kind == shimast.KindNonNullExpression {
    ctx.Report(right, "Nullish coalescing is unnecessary before a non-null assertion.")
  }
}

// noUnnecessaryTypeConstraint: `<T extends any>` / `<T extends unknown>`.
// typescript-eslint recommended: https://typescript-eslint.io/rules/no-unnecessary-type-constraint/
type noUnnecessaryTypeConstraint struct{}

func (noUnnecessaryTypeConstraint) Name() string { return "no-unnecessary-type-constraint" }
func (noUnnecessaryTypeConstraint) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindTypeParameter}
}
func (noUnnecessaryTypeConstraint) Check(ctx *Context, node *shimast.Node) {
  param := node.AsTypeParameterDeclaration()
  if param == nil || param.Constraint == nil {
    return
  }
  if param.Constraint.Kind != shimast.KindAnyKeyword && param.Constraint.Kind != shimast.KindUnknownKeyword {
    return
  }
  message := "Constraining a type parameter to any or unknown is unnecessary."
  // Delete the entire ` extends any|unknown` clause by spanning from the
  // end of the parameter's name to the end of the constraint node.
  name := param.Name()
  if name == nil {
    ctx.Report(param.Constraint, message)
    return
  }
  ctx.ReportFix(
    param.Constraint,
    message,
    TextEdit{Pos: name.End(), End: param.Constraint.End(), Text: ""},
  )
}

// noUnsafeFunctionType: `Function` accepts any callable shape.
// typescript-eslint recommended: https://typescript-eslint.io/rules/no-unsafe-function-type/
type noUnsafeFunctionType struct{}

func (noUnsafeFunctionType) Name() string           { return "no-unsafe-function-type" }
func (noUnsafeFunctionType) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindTypeReference} }
func (noUnsafeFunctionType) Check(ctx *Context, node *shimast.Node) {
  ref := node.AsTypeReferenceNode()
  if ref == nil || identifierText(ref.TypeName) != "Function" {
    return
  }
  ctx.Report(node, "The Function type is unsafe. Use a specific function type instead.")
}

// noWrapperObjectTypes: prefer primitive type keywords over boxed object
// type names such as `String` and `Boolean`.
// typescript-eslint recommended: https://typescript-eslint.io/rules/no-wrapper-object-types/
type noWrapperObjectTypes struct{}

func (noWrapperObjectTypes) Name() string           { return "no-wrapper-object-types" }
func (noWrapperObjectTypes) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindTypeReference} }
func (noWrapperObjectTypes) Check(ctx *Context, node *shimast.Node) {
  ref := node.AsTypeReferenceNode()
  if ref == nil {
    return
  }
  name := identifierText(ref.TypeName)
  primitive, ok := wrapperPrimitive(name)
  if !ok {
    return
  }
  message := "Use primitive type keywords instead of wrapper object types."
  // Shadow guard: if the user has declared `type String = …`,
  // `interface String { … }`, or `class String { … }` at file scope,
  // their `String` is NOT the global wrapper and a rewrite to `string`
  // would change the type. Pre-existing detection issue, but the fix
  // would silently corrupt the type — bail to detection-only when a
  // shadowing declaration exists in the same file.
  if fileShadowsWrapperName(ctx.File, name) {
    return
  }
  // `Object` maps to `object` in ESLint's fix, but the semantics shift
  // enough (boxed object vs lower-case object type) that we surface the
  // diagnostic without a fix and leave the rewrite to the author.
  if name == "Object" {
    ctx.Report(node, message)
    return
  }
  pos, end := tokenRange(ctx.File, ref.TypeName)
  if pos < 0 {
    ctx.Report(node, message)
    return
  }
  ctx.ReportFix(
    node,
    message,
    TextEdit{Pos: pos, End: end, Text: primitive},
  )
}

// fileShadowsWrapperName reports whether the source file declares its own
// `String`/`Number`/`Boolean`/`Symbol`/`BigInt`/`Object` at top level via
// `type`, `interface`, or `class`. Walks SourceFile.Statements once; no
// memoization because the rule already runs once per TypeReference and
// the average statement count per file dominates the cost over the inner
// loop.
func fileShadowsWrapperName(file *shimast.SourceFile, name string) bool {
  if file == nil || file.Statements == nil {
    return false
  }
  for _, stmt := range file.Statements.Nodes {
    if stmt == nil {
      continue
    }
    var declName *shimast.Node
    switch stmt.Kind {
    case shimast.KindTypeAliasDeclaration:
      if alias := stmt.AsTypeAliasDeclaration(); alias != nil {
        declName = alias.Name()
      }
    case shimast.KindInterfaceDeclaration:
      if iface := stmt.AsInterfaceDeclaration(); iface != nil {
        declName = iface.Name()
      }
    case shimast.KindClassDeclaration:
      if cls := stmt.AsClassDeclaration(); cls != nil {
        declName = cls.Name()
      }
    }
    if declName != nil && identifierText(declName) == name {
      return true
    }
  }
  return false
}

// wrapperPrimitive maps a boxed object type name (e.g. "String") to its
// primitive keyword equivalent (e.g. "string"). Returns ("", false) for
// names that are not recognized wrapper types.
func wrapperPrimitive(name string) (string, bool) {
  switch name {
  case "String":
    return "string", true
  case "Number":
    return "number", true
  case "Boolean":
    return "boolean", true
  case "Symbol":
    return "symbol", true
  case "BigInt":
    return "bigint", true
  case "Object":
    return "object", true
  }
  return "", false
}

// noUselessConstructor: an empty constructor with no parameters is noise.
// typescript-eslint strict: https://typescript-eslint.io/rules/no-useless-constructor/
type noUselessConstructor struct{}

func (noUselessConstructor) Name() string           { return "no-useless-constructor" }
func (noUselessConstructor) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindConstructor} }
func (noUselessConstructor) Check(ctx *Context, node *shimast.Node) {
  ctor := node.AsConstructorDeclaration()
  if ctor == nil || ctor.Body == nil {
    return
  }
  if len(node.Parameters()) != 0 {
    return
  }
  body := ctor.Body.AsBlock()
  if body == nil || body.Statements == nil || len(body.Statements.Nodes) == 0 {
    ctx.Report(node, "Useless empty constructor.")
  }
}

// preferLiteralEnumMember: computed enum members are harder to inspect.
// typescript-eslint strict: https://typescript-eslint.io/rules/prefer-literal-enum-member/
type preferLiteralEnumMember struct{}

func (preferLiteralEnumMember) Name() string           { return "prefer-literal-enum-member" }
func (preferLiteralEnumMember) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindEnumMember} }
func (preferLiteralEnumMember) Check(ctx *Context, node *shimast.Node) {
  member := node.AsEnumMember()
  if member == nil || member.Initializer == nil || isLiteralLike(member.Initializer) {
    return
  }
  ctx.Report(member.Initializer, "Enum member initializer should be a literal value.")
}

// consistentTypeAssertions: prefer `value as Type` over `<Type>value`.
// typescript-eslint stylistic: https://typescript-eslint.io/rules/consistent-type-assertions/
type consistentTypeAssertions struct{}

func (consistentTypeAssertions) Name() string { return "consistent-type-assertions" }
func (consistentTypeAssertions) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindTypeAssertionExpression}
}
func (consistentTypeAssertions) Check(ctx *Context, node *shimast.Node) {
  ctx.Report(node, "Use `as` type assertions instead of angle-bracket assertions.")
}

// consistentTypeDefinitions: prefer interfaces for object-shaped public
// contracts. This mirrors typescript-eslint's default option.
// typescript-eslint stylistic: https://typescript-eslint.io/rules/consistent-type-definitions/
type consistentTypeDefinitions struct{}

func (consistentTypeDefinitions) Name() string { return "consistent-type-definitions" }
func (consistentTypeDefinitions) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindTypeAliasDeclaration}
}
func (consistentTypeDefinitions) Check(ctx *Context, node *shimast.Node) {
  alias := node.AsTypeAliasDeclaration()
  if alias == nil || alias.Type == nil || alias.Type.Kind != shimast.KindTypeLiteral {
    return
  }
  ctx.Report(node, "Use an interface instead of a type literal alias.")
}

// dotNotation: `obj["prop"]` should be `obj.prop` when the key is a valid
// identifier.
// ESLint canonical: https://eslint.org/docs/latest/rules/dot-notation
type dotNotation struct{}

func (dotNotation) Name() string { return "dot-notation" }
func (dotNotation) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindElementAccessExpression}
}
func (dotNotation) Check(ctx *Context, node *shimast.Node) {
  access := node.AsElementAccessExpression()
  if access == nil || access.Expression == nil || access.ArgumentExpression == nil {
    return
  }
  key := stringLiteralText(access.ArgumentExpression)
  if key == "" || !isSimpleIdentifierName(key) {
    return
  }
  message := "Use dot notation instead of a string literal property access."
  // Conservative: keep reserved words as bracket access. Modern JS accepts
  // `obj.class`/`obj.if`/etc. syntactically but mixing them with member
  // expression syntax is jarring and can confuse minifiers and older runtimes.
  if isReservedWord(key) {
    ctx.Report(node, message)
    return
  }
  src := ctx.File.Text()
  // Determine where the bracket access begins. With an optional chain
  // (`obj?.["foo"]`) the `?.` token already separates object from access, so
  // we replace the `["foo"]` tail with `foo`. Otherwise we replace the
  // `["foo"]` tail with `.foo`.
  var replaceFrom int
  var replacement string
  if access.QuestionDotToken != nil {
    replaceFrom = shimscanner.SkipTrivia(src, access.QuestionDotToken.End())
    replacement = key
  } else {
    replaceFrom = access.Expression.End()
    replacement = "." + key
  }
  if replaceFrom < 0 || replaceFrom >= node.End() {
    ctx.Report(node, message)
    return
  }
  ctx.ReportFix(
    node,
    message,
    TextEdit{Pos: replaceFrom, End: node.End(), Text: replacement},
  )
}

// isReservedWord reports whether `value` is an ECMAScript reserved word. The
// `dot-notation` autofix uses this to skip the rewrite even though modern
// parsers accept reserved-word member names: leaving bracket access matches
// the conservative branch ESLint takes when `allowKeywords: false`.
func isReservedWord(value string) bool {
  switch value {
  case "break", "case", "catch", "class", "const", "continue",
    "debugger", "default", "delete", "do", "else", "enum",
    "export", "extends", "false", "finally", "for", "function",
    "if", "implements", "import", "in", "instanceof", "interface",
    "let", "new", "null", "package", "private", "protected",
    "public", "return", "static", "super", "switch", "this",
    "throw", "true", "try", "typeof", "var", "void",
    "while", "with", "yield", "await":
    return true
  }
  return false
}

// isSimpleIdentifierName reports whether value is a valid bare identifier
// (ASCII letters, digits, underscore, dollar sign; digits not first). Used
// by dotNotation to decide whether bracket access can become dot access.
func isSimpleIdentifierName(value string) bool {
  if value == "" {
    return false
  }
  for i, r := range value {
    if r == '_' || r == '$' || r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' {
      continue
    }
    if i > 0 && r >= '0' && r <= '9' {
      continue
    }
    return false
  }
  return true
}

// noUnsafeDeclarationMerging: class/interface merging hides runtime vs type
// surface differences.
// typescript-eslint recommended: https://typescript-eslint.io/rules/no-unsafe-declaration-merging/
type noUnsafeDeclarationMerging struct{}

func (noUnsafeDeclarationMerging) Name() string { return "no-unsafe-declaration-merging" }
func (noUnsafeDeclarationMerging) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}
func (noUnsafeDeclarationMerging) Check(ctx *Context, node *shimast.Node) {
  classes := map[string]bool{}
  var interfaces []*shimast.Node
  walkDescendants(node, func(child *shimast.Node) {
    switch child.Kind {
    case shimast.KindClassDeclaration:
      decl := child.AsClassDeclaration()
      if decl != nil {
        if name := identifierText(decl.Name()); name != "" {
          classes[name] = true
        }
      }
    case shimast.KindInterfaceDeclaration:
      interfaces = append(interfaces, child)
    }
  })
  for _, ifaceNode := range interfaces {
    decl := ifaceNode.AsInterfaceDeclaration()
    if decl == nil {
      continue
    }
    name := identifierText(decl.Name())
    if name != "" && classes[name] {
      ctx.Report(ifaceNode, "Unsafe declaration merging between class and interface '"+name+"'.")
    }
  }
}

func init() {
  Register(noEmptyStaticBlock{})
  Register(noSetterReturn{})
  Register(noUnusedLabels{})
  Register(noDynamicDelete{})
  Register(noNonNullAssertedNullishCoalescing{})
  Register(noUnnecessaryTypeConstraint{})
  Register(noUnsafeDeclarationMerging{})
  Register(noUnsafeFunctionType{})
  Register(noWrapperObjectTypes{})
  Register(noUselessConstructor{})
  Register(preferLiteralEnumMember{})
  Register(consistentTypeAssertions{})
  Register(consistentTypeDefinitions{})
  Register(dotNotation{})
}
