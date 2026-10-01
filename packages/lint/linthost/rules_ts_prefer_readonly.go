package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

// preferReadonly suggests readonly for initialized private fields without
// resolved writes in their source file. The Checker distinguishes aliases and
// equally named members of other classes; reflective or any-typed writes are
// outside this source analysis. No automatic edit is offered.
//
// @evidence contracts/common.md#principled-implementation Checker member declarations identify written fields, so an initializer alone never establishes absence of reassignment.
// @evidence contracts/common.md#clear-and-simple-design Candidate selection reads one file-scoped write census; assignment target traversal owns destructuring and member identity.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Unresolved runtime mutation is not claimed absent; the diagnostic states the actual resolved source-file boundary without a safe-edit guarantee.
// @evidence contracts/common.md#meaningful-documentation Native prose describes Checker ownership, reflective limitations and diagnostic-only behavior; the TypeScript rule map and guide describe the same boundary.
type preferReadonly struct{}

func (preferReadonly) Name() string { return "typescript/prefer-readonly" }
func (preferReadonly) NeedsTypeChecker() bool { return true }
func (preferReadonly) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindPropertyDeclaration}
}
func (preferReadonly) Check(ctx *Context, node *shimast.Node) {
  if ctx.Checker == nil || ctx.File == nil {
    return
  }
  parent := node.Parent
  if parent == nil ||
    (parent.Kind != shimast.KindClassDeclaration && parent.Kind != shimast.KindClassExpression) {
    return
  }
  if hasModifier(node, shimast.KindReadonlyKeyword) || !preferReadonlyIsPrivate(node) {
    return
  }
  decl := node.AsPropertyDeclaration()
  if decl == nil || decl.Initializer == nil || preferReadonlyWrittenFields(ctx)[node] {
    return
  }
  ctx.Report(node, "Private field has no resolved reassignment in this source file. Consider `readonly`.")
}

// preferReadonlyIsPrivate accepts TypeScript and JavaScript private fields.
func preferReadonlyIsPrivate(node *shimast.Node) bool {
  if hasModifier(node, shimast.KindPrivateKeyword) {
    return true
  }
  return node.Name() != nil && node.Name().Kind == shimast.KindPrivateIdentifier
}

// preferReadonlyWritesKey separates this census from other file memo entries.
type preferReadonlyWritesKey struct{}

// preferReadonlyWrittenFields computes one census per file walk. The Engine's
// memo ends with that walk, so changed files and later Checker instances never
// inherit old declaration identities. Nested scopes still contribute writes.
//
// @evidence contracts/common.md#principled-implementation Assignment, update, deletion and loop targets resolve to declaration nodes through the same Checker used for this source file.
// @evidence contracts/common.md#clear-and-simple-design One operation enumerates writes and delegates target interpretation; declaration identity avoids textual field-name matching.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The owned Engine memo shares only a fixed file/Checker census, without modifying foreign AST nodes or assuming constructor initialization is immutable.
// @evidence contracts/common.md#meaningful-documentation The comment states census lifetime and nested-scope behavior; dynamic targets conservatively retain their receiver's members.
func preferReadonlyWrittenFields(ctx *Context) map[*shimast.Node]bool {
  if cached, ok := ctx.fileValue(preferReadonlyWritesKey{}); ok {
    return cached.(map[*shimast.Node]bool)
  }
  written := map[*shimast.Node]bool{}
  walkDescendants(ctx.File.AsNode(), func(node *shimast.Node) {
    switch node.Kind {
    case shimast.KindBinaryExpression:
      expr := node.AsBinaryExpression()
      if expr.OperatorToken != nil && isAssignmentOperator(expr.OperatorToken.Kind) && !isDestructuringDefaultAssignment(node) {
        preferReadonlyRecordTarget(ctx, expr.Left, written)
      }
    case shimast.KindPrefixUnaryExpression:
      expr := node.AsPrefixUnaryExpression()
      if expr.Operator == shimast.KindPlusPlusToken || expr.Operator == shimast.KindMinusMinusToken {
        preferReadonlyRecordTarget(ctx, expr.Operand, written)
      }
    case shimast.KindPostfixUnaryExpression:
      expr := node.AsPostfixUnaryExpression()
      if expr.Operator == shimast.KindPlusPlusToken || expr.Operator == shimast.KindMinusMinusToken {
        preferReadonlyRecordTarget(ctx, expr.Operand, written)
      }
    case shimast.KindDeleteExpression:
      preferReadonlyRecordTarget(ctx, node.AsDeleteExpression().Expression, written)
    case shimast.KindForInStatement, shimast.KindForOfStatement:
      preferReadonlyRecordTarget(ctx, node.AsForInOrOfStatement().Initializer, written)
    }
  })
  ctx.setFileValue(preferReadonlyWritesKey{}, written)
  return written
}

// preferReadonlyRecordTarget follows write positions, not property receivers or
// computed names. Thus replacing this.value writes the field, but assigning
// this.value.n only writes n. Dynamic indexed writes conservatively retain all
// resolved receiver properties instead of guessing which key will be used.
//
// @evidence contracts/common.md#principled-implementation Assignment-pattern values and defaults' left sides are write positions; member symbols supply defining declarations across aliases and instantiated types.
// @evidence contracts/common.md#clear-and-simple-design The target-kind switch mirrors assignment syntax and stops at a member, keeping object mutation separate from field replacement.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Dynamic receiver properties are conservatively marked rather than treating an unknown key as proof of no mutation.
// @evidence contracts/common.md#meaningful-documentation Native prose explains computed keys, deep object mutation and the deliberately conservative dynamic-index boundary.
func preferReadonlyRecordTarget(ctx *Context, target *shimast.Node, written map[*shimast.Node]bool) {
  if target == nil {
    return
  }
  record := func(symbol *shimast.Symbol) {
    if symbol != nil {
      for _, decl := range symbol.Declarations {
        if decl != nil && decl.Kind == shimast.KindPropertyDeclaration {
          written[decl] = true
        }
      }
    }
  }
  switch target.Kind {
  case shimast.KindPropertyAccessExpression:
    record(ctx.Checker.GetSymbolAtLocation(target.AsPropertyAccessExpression().Name()))
  case shimast.KindElementAccessExpression:
    access := target.AsElementAccessExpression()
    receiver := ctx.Checker.GetTypeAtLocation(access.Expression)
    if receiver == nil {
      return
    }
    key := stripParens(access.ArgumentExpression)
    if key != nil && (key.Kind == shimast.KindStringLiteral || key.Kind == shimast.KindNoSubstitutionTemplateLiteral) {
      record(ctx.Checker.GetPropertyOfType(receiver, stringLiteralText(key)))
    } else {
      for _, property := range ctx.Checker.GetPropertiesOfType(receiver) {
        record(property)
      }
    }
  case shimast.KindParenthesizedExpression, shimast.KindAsExpression,
    shimast.KindTypeAssertionExpression, shimast.KindNonNullExpression,
    shimast.KindSatisfiesExpression, shimast.KindSpreadElement, shimast.KindSpreadAssignment:
    preferReadonlyRecordTarget(ctx, target.Expression(), written)
  case shimast.KindArrayLiteralExpression:
    if elements := target.AsArrayLiteralExpression().Elements; elements != nil {
      for _, element := range elements.Nodes {
        preferReadonlyRecordTarget(ctx, element, written)
      }
    }
  case shimast.KindObjectLiteralExpression:
    if properties := target.AsObjectLiteralExpression().Properties; properties != nil {
      for _, property := range properties.Nodes {
        preferReadonlyRecordTarget(ctx, property, written)
      }
    }
  case shimast.KindPropertyAssignment:
    preferReadonlyRecordTarget(ctx, target.AsPropertyAssignment().Initializer, written)
  case shimast.KindBinaryExpression:
    if expr := target.AsBinaryExpression(); expr.OperatorToken != nil && expr.OperatorToken.Kind == shimast.KindEqualsToken {
      preferReadonlyRecordTarget(ctx, expr.Left, written)
    }
  }
}

func init() {
  Register(preferReadonly{})
}
