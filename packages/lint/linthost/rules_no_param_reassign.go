// noParamReassign rejects writes to the binding introduced by a function
// parameter. Binding identity comes from the TypeScript checker, so a local
// shadow is independent while a nested function that closes over the parameter
// still counts. Destructured, defaulted, and rest parameters are resolved by
// their individual binding leaves.
//
// With `props: true`, the rule also follows the parameter reference through
// member, call, conditional-result, and destructuring-target syntax to find
// property writes. The two official ignore lists apply only to those property
// writes; assigning the parameter binding itself is always reported.
// https://eslint.org/docs/latest/rules/no-param-reassign
package linthost

import (
  "regexp"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

type noParamReassign struct{}

type noParamReassignOptions struct {
  Props                               bool     `json:"props"`
  IgnorePropertyModificationsFor      []string `json:"ignorePropertyModificationsFor"`
  IgnorePropertyModificationsForRegex []string `json:"ignorePropertyModificationsForRegex"`
}

type noParamReassignParameter struct {
  name string
}

func (noParamReassign) Name() string { return "no-param-reassign" }
func (noParamReassign) NeedsTypeChecker() bool {
  return true
}
func (noParamReassign) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }

func (noParamReassign) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.Checker == nil || node == nil {
    return
  }

  var options noParamReassignOptions
  _ = ctx.DecodeOptions(&options)

  parameters := make(map[*shimast.Symbol]noParamReassignParameter)
  parameterNames := make(map[string]struct{})
  walkDescendants(node, func(child *shimast.Node) {
    if !isFunctionLikeKind(child) {
      return
    }
    for _, parameterNode := range child.Parameters() {
      parameter := parameterNode.AsParameterDeclaration()
      if parameter == nil {
        continue
      }
      for _, nameNode := range bindingIdentifierNodes(parameter.Name()) {
        name := identifierText(nameNode)
        symbol := noParamReassignParameterSymbol(ctx, parameterNode, nameNode, name)
        if symbol == nil || name == "" {
          continue
        }
        parameters[symbol] = noParamReassignParameter{name: name}
        parameterNames[name] = struct{}{}
      }
    }
  })
  if len(parameters) == 0 {
    return
  }

  directTargets := make(map[*shimast.Node]struct{})
  reportDirectTarget := func(target *shimast.Node) {
    if target == nil || target.Kind != shimast.KindIdentifier {
      return
    }
    if _, reported := directTargets[target]; reported {
      return
    }
    parameter, ok := parameters[valueSymbolAtIdentifier(ctx, target)]
    if !ok {
      return
    }
    directTargets[target] = struct{}{}
    ctx.Report(target, "Assignment to function parameter '"+parameter.name+"'.")
  }

  walkDescendants(node, func(child *shimast.Node) {
    switch child.Kind {
    case shimast.KindBinaryExpression:
      expression := child.AsBinaryExpression()
      if expression == nil || expression.OperatorToken == nil ||
        !isAssignmentOperator(expression.OperatorToken.Kind) ||
        isDestructuringDefaultAssignment(child) {
        return
      }
      for _, target := range assignmentTargetIdentifiers(expression.Left) {
        reportDirectTarget(target)
      }
    case shimast.KindPrefixUnaryExpression:
      expression := child.AsPrefixUnaryExpression()
      if expression == nil ||
        (expression.Operator != shimast.KindPlusPlusToken && expression.Operator != shimast.KindMinusMinusToken) {
        return
      }
      for _, target := range assignmentTargetIdentifiers(expression.Operand) {
        reportDirectTarget(target)
      }
    case shimast.KindPostfixUnaryExpression:
      expression := child.AsPostfixUnaryExpression()
      if expression == nil ||
        (expression.Operator != shimast.KindPlusPlusToken && expression.Operator != shimast.KindMinusMinusToken) {
        return
      }
      for _, target := range assignmentTargetIdentifiers(expression.Operand) {
        reportDirectTarget(target)
      }
    case shimast.KindForInStatement, shimast.KindForOfStatement:
      statement := child.AsForInOrOfStatement()
      if statement == nil || statement.Initializer == nil ||
        statement.Initializer.Kind == shimast.KindVariableDeclarationList {
        return
      }
      for _, target := range assignmentTargetIdentifiers(statement.Initializer) {
        reportDirectTarget(target)
      }
    }
  })

  if !options.Props {
    return
  }
  ignoredNames := make(map[string]struct{}, len(options.IgnorePropertyModificationsFor))
  for _, name := range options.IgnorePropertyModificationsFor {
    ignoredNames[name] = struct{}{}
  }
  ignoredPatterns := make([]*regexp.Regexp, 0, len(options.IgnorePropertyModificationsForRegex))
  for _, pattern := range options.IgnorePropertyModificationsForRegex {
    if compiled, err := regexp.Compile(pattern); err == nil {
      ignoredPatterns = append(ignoredPatterns, compiled)
    }
  }

  walkDescendants(node, func(child *shimast.Node) {
    if child.Kind != shimast.KindIdentifier {
      return
    }
    if _, direct := directTargets[child]; direct {
      return
    }
    if _, possibleParameter := parameterNames[identifierText(child)]; !possibleParameter {
      return
    }
    parameter, ok := parameters[valueSymbolAtIdentifier(ctx, child)]
    if !ok || noParamReassignIgnoresProperty(parameter.name, ignoredNames, ignoredPatterns) {
      return
    }
    if noParamReassignModifiesProperty(child) {
      ctx.Report(child, "Assignment to property of function parameter '"+parameter.name+"'.")
    }
  })
}

// A TypeScript parameter property has two symbols at one declaration: the
// constructor-local parameter and the class member. GetSymbolAtLocation is
// deliberately fuzzy for declaration names and may select the member, while
// references in the constructor body resolve to the parameter. The constructor
// locals are the canonical binding table for body references; looking up that
// table also avoids the checker's pair API, which panics on malformed parameter
// properties instead of returning a partial result.
func noParamReassignParameterSymbol(
  ctx *Context,
  parameterNode *shimast.Node,
  nameNode *shimast.Node,
  name string,
) *shimast.Symbol {
  if ctx == nil || ctx.Checker == nil || parameterNode == nil || nameNode == nil || name == "" {
    return nil
  }
  if parameterNode.Parent != nil && parameterNode.Parent.Kind == shimast.KindConstructor &&
    isParameterProperty(parameterNode) {
    return parameterNode.Parent.Locals()[name]
  }
  return ctx.Checker.GetSymbolAtLocation(nameNode)
}

func noParamReassignIgnoresProperty(
  name string,
  names map[string]struct{},
  patterns []*regexp.Regexp,
) bool {
  if _, ignored := names[name]; ignored {
    return true
  }
  for _, pattern := range patterns {
    if pattern.MatchString(name) {
      return true
    }
  }
  return false
}

// noParamReassignModifiesProperty mirrors ESLint's reference-parent walk. A
// parameter reference contributes to the value being mutated only through the
// receiver/callee side of member and call expressions. Computed keys, call
// arguments, property names, and conditional tests are read-only branches.
func noParamReassignModifiesProperty(identifier *shimast.Node) bool {
  current := identifier
  for current != nil && current.Parent != nil {
    parent := current.Parent
    switch parent.Kind {
    case shimast.KindBinaryExpression:
      expression := parent.AsBinaryExpression()
      if expression != nil && expression.OperatorToken != nil && isAssignmentOperator(expression.OperatorToken.Kind) {
        return expression.Left == current
      }
    case shimast.KindPrefixUnaryExpression:
      expression := parent.AsPrefixUnaryExpression()
      if expression != nil &&
        (expression.Operator == shimast.KindPlusPlusToken || expression.Operator == shimast.KindMinusMinusToken) {
        return expression.Operand == current
      }
    case shimast.KindPostfixUnaryExpression:
      expression := parent.AsPostfixUnaryExpression()
      if expression != nil &&
        (expression.Operator == shimast.KindPlusPlusToken || expression.Operator == shimast.KindMinusMinusToken) {
        return expression.Operand == current
      }
    case shimast.KindDeleteExpression:
      expression := parent.AsDeleteExpression()
      return expression != nil && expression.Expression == current
    case shimast.KindForInStatement, shimast.KindForOfStatement:
      statement := parent.AsForInOrOfStatement()
      return statement != nil && statement.Initializer == current
    case shimast.KindCallExpression:
      expression := parent.AsCallExpression()
      if expression == nil || expression.Expression != current {
        return false
      }
    case shimast.KindNewExpression:
      expression := parent.AsNewExpression()
      if expression == nil || expression.Expression != current {
        return false
      }
    case shimast.KindPropertyAccessExpression:
      expression := parent.AsPropertyAccessExpression()
      if expression == nil || expression.Expression != current {
        return false
      }
    case shimast.KindElementAccessExpression:
      expression := parent.AsElementAccessExpression()
      if expression == nil || expression.Expression != current {
        return false
      }
    case shimast.KindConditionalExpression:
      expression := parent.AsConditionalExpression()
      if expression == nil || expression.Condition == current {
        return false
      }
    case shimast.KindPropertyAssignment:
      property := parent.AsPropertyAssignment()
      if property == nil || property.Name() == current {
        return false
      }
    case shimast.KindShorthandPropertyAssignment:
      property := parent.AsShorthandPropertyAssignment()
      if property == nil || property.Name() == current {
        return false
      }
    case shimast.KindBindingElement:
      element := parent.AsBindingElement()
      if element == nil || element.PropertyName == current || element.Initializer == current {
        return false
      }
    case shimast.KindComputedPropertyName:
      return false
    }

    if noParamReassignPropertyWalkStopsAt(parent) {
      return false
    }
    current = parent
  }
  return false
}

func noParamReassignPropertyWalkStopsAt(node *shimast.Node) bool {
  if node == nil || node.Kind == shimast.KindSourceFile || isFunctionLikeKind(node) {
    return true
  }
  if node.Kind >= shimast.KindFirstStatement && node.Kind <= shimast.KindLastStatement {
    return true
  }
  switch node.Kind {
  case shimast.KindParameter,
    shimast.KindVariableDeclaration,
    shimast.KindPropertyDeclaration,
    shimast.KindClassDeclaration,
    shimast.KindInterfaceDeclaration,
    shimast.KindTypeAliasDeclaration,
    shimast.KindEnumDeclaration,
    shimast.KindModuleDeclaration:
    return true
  }
  return false
}

func init() {
  Register(noParamReassign{})
}
