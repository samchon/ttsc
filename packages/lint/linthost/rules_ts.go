// Core TypeScript-specific lint rules: direct ports of the most commonly
// enabled @typescript-eslint/recommended and @typescript-eslint/stylistic
// rules that require only AST inspection (no checker or scope analysis).
// Each rule is registered in the package init function at the bottom.
package linthost

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// noExplicitAny: ban `: any` annotations. Loud equivalent of
// `@typescript-eslint/no-explicit-any`.
type noExplicitAny struct{}

func (noExplicitAny) Name() string           { return "typescript/no-explicit-any" }
func (noExplicitAny) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindAnyKeyword} }
func (noExplicitAny) Check(ctx *Context, node *shimast.Node) {
  ctx.Report(node, "Unexpected any. Specify a different type.")
}

// noNonNullAssertion: ban the postfix `!` non-null assertion.
type noNonNullAssertion struct{}

func (noNonNullAssertion) Name() string { return "typescript/no-non-null-assertion" }
func (noNonNullAssertion) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindNonNullExpression}
}
func (noNonNullAssertion) Check(ctx *Context, node *shimast.Node) {
  ctx.Report(node, "Forbidden non-null assertion.")
}

// noEmptyInterface: empty `interface { }` declarations are an alias
// for the supertype with extra ceremony.
type noEmptyInterface struct{}

func (noEmptyInterface) Name() string { return "typescript/no-empty-interface" }
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

// noInferrableTypes: `let x: number = 0` — the annotation is what TS
// would have inferred anyway.
type noInferrableTypes struct{}

func (noInferrableTypes) Name() string { return "typescript/no-inferrable-types" }
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

// isInferrablePair reports whether typeNode is a type annotation that
// TypeScript would have inferred automatically from the initializer init.
// Only covers the scalar literal kinds: string, number, boolean, bigint,
// null, and undefined.
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

// isUnaryNumeric reports whether node is a unary +/- applied to a numeric
// literal (e.g. `-1`, `+0`). Used by isInferrablePair for the number case.
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

// noNamespace: TypeScript-only `namespace`/`module` declarations. They
// exist for legacy reasons; modern TS uses ES modules.
type noNamespace struct{}

func (noNamespace) Name() string           { return "typescript/no-namespace" }
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

// noThisAlias: `const self = this;` reassigns `this` to a local. Use
// arrow functions or `.bind(this)` instead.
type noThisAlias struct{}

func (noThisAlias) Name() string           { return "typescript/no-this-alias" }
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

// preferAsConst: `as 'foo'` / `<'foo'>` assertions and `let x: 'foo' = 'foo'`
// variable / class-property annotations should use `as const`. Port of
// `@typescript-eslint/prefer-as-const`, which visits the same four AST
// families and compares the literals' raw source spelling.
type preferAsConst struct{}

func (preferAsConst) Name() string { return "typescript/prefer-as-const" }
func (preferAsConst) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindAsExpression,
    shimast.KindTypeAssertionExpression,
    shimast.KindVariableDeclaration,
    shimast.KindPropertyDeclaration,
  }
}
func (preferAsConst) Check(ctx *Context, node *shimast.Node) {
  switch node.Kind {
  case shimast.KindAsExpression:
    if as := node.AsAsExpression(); as != nil {
      preferAsConstCheckAssertion(ctx, as.Expression, as.Type)
    }
  case shimast.KindTypeAssertionExpression:
    if ta := node.AsTypeAssertion(); ta != nil {
      preferAsConstCheckAssertion(ctx, ta.Expression, ta.Type)
    }
  case shimast.KindVariableDeclaration:
    if decl := node.AsVariableDeclaration(); decl != nil {
      preferAsConstCheckAnnotation(ctx, node, decl.Initializer, decl.Type)
    }
  case shimast.KindPropertyDeclaration:
    decl := node.AsPropertyDeclaration()
    if decl == nil {
      return
    }
    // `accessor` fields surface upstream as AccessorProperty nodes, which
    // the rule's PropertyDefinition visitor never receives; get/set
    // accessors and methods are separate AST kinds already.
    if node.ModifierFlags()&shimast.ModifierFlagsAccessor != 0 {
      return
    }
    preferAsConstCheckAnnotation(ctx, node, decl.Initializer, decl.Type)
  }
}

// preferAsConstCheckAssertion handles the `expr as T` / `<T>expr` assertion
// forms. These are directly autofixable: the literal type becomes `const`, and
// any type-only parentheses are removed without disturbing their comments.
func preferAsConstCheckAssertion(ctx *Context, expr, typeNode *shimast.Node) {
  if !preferAsConstLiteralsMatch(ctx.File, expr, typeNode) {
    return
  }
  message := "Expected `as const` instead of `as` literal type."
  edits := preferAsConstAssertionEdits(ctx.File, typeNode)
  if len(edits) == 0 {
    ctx.Report(typeNode, message)
    return
  }
  ctx.ReportFix(typeNode, message, edits...)
}

// preferAsConstAssertionEdits replaces the innermost literal type and removes
// only the syntactic parentheses around it. Keeping the trivia between those
// tokens preserves comments while producing valid `as const` / `<const>`
// syntax instead of the invalid `as (const)` shape.
func preferAsConstAssertionEdits(file *shimast.SourceFile, typeNode *shimast.Node) []TextEdit {
  if file == nil || typeNode == nil {
    return nil
  }
  edits := []TextEdit{}
  for typeNode.Kind == shimast.KindParenthesizedType {
    parenthesized := typeNode.AsParenthesizedTypeNode()
    if parenthesized == nil || parenthesized.Type == nil {
      return nil
    }
    openScanner := shimscanner.GetScannerForSourceFile(file, typeNode.Pos())
    if openScanner.Token() != shimast.KindOpenParenToken {
      return nil
    }
    closeScanner := shimscanner.GetScannerForSourceFile(file, parenthesized.Type.End())
    if closeScanner.Token() != shimast.KindCloseParenToken || closeScanner.TokenEnd() > typeNode.End() {
      return nil
    }
    edits = append(edits,
      TextEdit{Pos: openScanner.TokenStart(), End: openScanner.TokenEnd()},
      TextEdit{Pos: closeScanner.TokenStart(), End: closeScanner.TokenEnd()},
    )
    typeNode = parenthesized.Type
  }
  pos, end := tokenRange(file, typeNode)
  if pos < 0 {
    return nil
  }
  return append(edits, TextEdit{Pos: pos, End: end, Text: "const"})
}

// preferAsConstCheckAnnotation handles variable declarators and class
// property declarations whose literal type annotation repeats the
// initializer literal. The upstream rule pairs this report with a manual
// suggestion, not an autofix: it removes the annotation and appends `as const`
// after the initializer while `eslint --fix` leaves the declaration alone.
func preferAsConstCheckAnnotation(ctx *Context, declaration, init, typeNode *shimast.Node) {
  if init == nil || !preferAsConstLiteralsMatch(ctx.File, init, typeNode) {
    return
  }
  annotationStart := preferAsConstAnnotationStart(ctx.File, declaration, typeNode)
  _, annotationEnd := tokenRange(ctx.File, typeNode)
  message := "Expected a `const` assertion instead of a literal type annotation."
  if annotationStart < 0 || annotationEnd < annotationStart || init.End() < annotationEnd {
    ctx.Report(typeNode, message)
    return
  }
  ctx.ReportSuggestion(
    typeNode,
    message,
    "Replace the literal type annotation with `as const`.",
    TextEdit{
      Pos:  annotationStart,
      End:  annotationEnd,
      Text: preferAsConstPreservedAnnotationComments(ctx.File, annotationStart, annotationEnd),
    },
    TextEdit{
      Pos:  init.End(),
      End:  init.End(),
      Text: " as const",
    },
  )
}

// preferAsConstPreservedAnnotationComments keeps comments embedded in the
// removed annotation. Multiline comments remain space-separated; line comments
// retain their line ending so the following initializer cannot be commented
// out. Syntax tokens and whitespace are intentionally discarded.
func preferAsConstPreservedAnnotationComments(file *shimast.SourceFile, start, end int) string {
  if file == nil || start < 0 || end <= start || end > len(file.Text()) {
    return ""
  }
  src := file.Text()
  scanner := shimscanner.GetScannerForSourceFile(file, start)
  scanner.SetSkipTrivia(false)
  var preserved strings.Builder
  lineEnded := false
  for scanner.TokenStart() < end && scanner.Token() != shimast.KindEndOfFile {
    kind := scanner.Token()
    if kind == shimast.KindSingleLineCommentTrivia || kind == shimast.KindMultiLineCommentTrivia {
      if preserved.Len() == 0 || !lineEnded {
        preserved.WriteByte(' ')
      }
      preserved.WriteString(scanner.TokenText())
      lineEnded = false
      if kind == shimast.KindSingleLineCommentTrivia {
        switch tokenEnd := scanner.TokenEnd(); {
        case tokenEnd+1 < len(src) && src[tokenEnd:tokenEnd+2] == "\r\n":
          preserved.WriteString("\r\n")
        case tokenEnd < len(src) && (src[tokenEnd] == '\r' || src[tokenEnd] == '\n'):
          preserved.WriteByte(src[tokenEnd])
        default:
          preserved.WriteByte('\n')
        }
        lineEnded = true
      }
    }
    scanner.Scan()
  }
  return preserved.String()
}

// preferAsConstAnnotationStart locates the annotation's colon by tokenizing
// only the declaration segment between its name and type. This preserves
// modifiers, computed names, and postfix `?` / `!` markers without relying on
// source-text regular expressions.
func preferAsConstAnnotationStart(file *shimast.SourceFile, declaration, typeNode *shimast.Node) int {
  if file == nil || declaration == nil || typeNode == nil || declaration.Name() == nil {
    return -1
  }
  scanner := shimscanner.GetScannerForSourceFile(file, declaration.Name().End())
  for {
    kind := scanner.Token()
    if kind == shimast.KindColonToken {
      return scanner.TokenStart()
    }
    if kind == shimast.KindEndOfFile || scanner.TokenStart() >= typeNode.End() {
      return -1
    }
    scanner.Scan()
  }
}

// preferAsConstLiteralsMatch reports whether typeNode is a literal type
// whose literal token repeats expr's exact source spelling. Mirrors the
// upstream check `valueNode.raw === typeNode.literal.raw` between ESTree
// `Literal` nodes: string, numeric, bigint, and boolean literals qualify on
// both sides. Template literals (ESTree `TemplateLiteral`) and `null`
// (whose type position surfaces upstream as `TSNullKeyword`, not
// `TSLiteralType`) are excluded, so a template literal asserted to its
// identically spelled template literal type and `null as null` stay clean
// exactly like the upstream fixtures.
func preferAsConstLiteralsMatch(file *shimast.SourceFile, expr, typeNode *shimast.Node) bool {
  if expr == nil || typeNode == nil {
    return false
  }
  // typescript-estree erases both expression and type parentheses, so tsgo's
  // ParenthesizedType wrappers must not affect the upstream raw-literal check.
  typeNode = preferAsConstUnwrapType(typeNode)
  if typeNode == nil || typeNode.Kind != shimast.KindLiteralType {
    return false
  }
  literalType := typeNode.AsLiteralTypeNode()
  if literalType == nil || literalType.Literal == nil {
    return false
  }
  // ESTree does not represent expression parentheses, so upstream sees the
  // bare literal in `('a') as 'a'` and reports it; descend to the same
  // canonical node.
  expr = stripParens(expr)
  if !isPreferAsConstLiteral(expr) || !isPreferAsConstLiteral(literalType.Literal) {
    return false
  }
  return nodeText(file, expr) == nodeText(file, literalType.Literal)
}

func preferAsConstUnwrapType(typeNode *shimast.Node) *shimast.Node {
  for typeNode != nil && typeNode.Kind == shimast.KindParenthesizedType {
    parenthesized := typeNode.AsParenthesizedTypeNode()
    if parenthesized == nil || parenthesized.Type == nil {
      return nil
    }
    typeNode = parenthesized.Type
  }
  return typeNode
}

// isPreferAsConstLiteral reports whether node is one of the literal token
// kinds ts-estree maps to an ESTree `Literal` in both the expression and
// the literal-type position. `null` and regular-expression literals map to
// `Literal` in expression position only; neither can raw-match a literal
// type (a `null` annotation is `TSNullKeyword` upstream and regexes cannot
// appear in type position), so excluding them here is equivalent to the
// upstream shape check.
func isPreferAsConstLiteral(node *shimast.Node) bool {
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindStringLiteral,
    shimast.KindNumericLiteral,
    shimast.KindBigIntLiteral,
    shimast.KindTrueKeyword,
    shimast.KindFalseKeyword:
    return true
  }
  return false
}

// noRequireImports: ban `require(...)` calls in TS source. Use
// ES `import` instead.
type noRequireImports struct{}

func (noRequireImports) Name() string { return "typescript/no-require-imports" }
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

func init() {
  Register(noExplicitAny{})
  Register(noNonNullAssertion{})
  Register(noEmptyInterface{})
  Register(noInferrableTypes{})
  Register(noNamespace{})
  Register(noThisAlias{})
  Register(preferAsConst{})
  Register(noRequireImports{})
}
