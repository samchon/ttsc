// noImportAssign reports writes to bindings introduced by imports. Binding
// identity comes from TypeScript's checker, so a same-spelled declaration in a
// nested scope is independent from the import it shadows.
//
// Namespace imports additionally protect their direct members. This follows
// ESLint's contract for assignments, updates, deletes, loop targets, and the
// standard Object/Reflect mutation functions without treating deeper exported
// objects as namespace members.
// https://eslint.org/docs/latest/rules/no-import-assign
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

type noImportAssign struct{}

func (noImportAssign) Name() string           { return "no-import-assign" }
func (noImportAssign) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }
func (noImportAssign) NeedsTypeChecker() bool { return true }

func (noImportAssign) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.Checker == nil || node == nil {
    return
  }
  imported, namespaces := collectNoImportAssignBindings(ctx, node)
  if len(imported) == 0 {
    return
  }

  walkDescendants(node, func(candidate *shimast.Node) {
    switch candidate.Kind {
    case shimast.KindBinaryExpression:
      expression := candidate.AsBinaryExpression()
      if expression == nil || expression.OperatorToken == nil ||
        !isAssignmentOperator(expression.OperatorToken.Kind) ||
        isDestructuringAssignmentTarget(candidate) {
        return
      }
      reportNoImportAssignTarget(ctx, candidate, expression.Left, imported, namespaces, true)

    case shimast.KindPrefixUnaryExpression:
      expression := candidate.AsPrefixUnaryExpression()
      if expression == nil ||
        (expression.Operator != shimast.KindPlusPlusToken && expression.Operator != shimast.KindMinusMinusToken) {
        return
      }
      reportNoImportAssignTarget(ctx, candidate, expression.Operand, imported, namespaces, true)

    case shimast.KindPostfixUnaryExpression:
      expression := candidate.AsPostfixUnaryExpression()
      if expression == nil ||
        (expression.Operator != shimast.KindPlusPlusToken && expression.Operator != shimast.KindMinusMinusToken) {
        return
      }
      reportNoImportAssignTarget(ctx, candidate, expression.Operand, imported, namespaces, true)

    case shimast.KindDeleteExpression:
      expression := candidate.AsDeleteExpression()
      if expression != nil {
        // ESLint treats delete as a namespace-member mutation. Bare delete is
        // covered by no-delete-var rather than as an import assignment.
        reportNoImportAssignTarget(ctx, candidate, expression.Expression, imported, namespaces, false)
      }

    case shimast.KindForInStatement, shimast.KindForOfStatement:
      statement := candidate.AsForInOrOfStatement()
      if statement == nil || statement.Initializer == nil ||
        statement.Initializer.Kind == shimast.KindVariableDeclarationList {
        return
      }
      reportNoImportAssignTarget(ctx, candidate, statement.Initializer, imported, namespaces, true)

    case shimast.KindCallExpression:
      reportNoImportAssignMutationCall(ctx, candidate, namespaces)
    }
  })
}

// collectNoImportAssignBindings records the checker symbol owned by every
// default, named, namespace, type-only, and import-equals local name. References
// are compared against these symbols rather than their text.
func collectNoImportAssignBindings(
  ctx *Context,
  file *shimast.Node,
) (map[*shimast.Symbol]string, map[*shimast.Symbol]string) {
  imported := map[*shimast.Symbol]string{}
  namespaces := map[*shimast.Symbol]string{}
  add := func(name *shimast.Node, namespace bool) {
    symbol := noImportAssignValueSymbol(ctx, name)
    localName := identifierText(name)
    if symbol == nil || localName == "" {
      return
    }
    imported[symbol] = localName
    if namespace {
      namespaces[symbol] = localName
    }
  }

  walkDescendants(file, func(node *shimast.Node) {
    switch node.Kind {
    case shimast.KindImportDeclaration:
      declaration := node.AsImportDeclaration()
      if declaration == nil || declaration.ImportClause == nil {
        return
      }
      clause := declaration.ImportClause.AsImportClause()
      if clause == nil {
        return
      }
      add(clause.Name(), false)
      if clause.NamedBindings == nil {
        return
      }
      switch clause.NamedBindings.Kind {
      case shimast.KindNamedImports:
        named := clause.NamedBindings.AsNamedImports()
        if named == nil || named.Elements == nil {
          return
        }
        for _, element := range named.Elements.Nodes {
          if specifier := element.AsImportSpecifier(); specifier != nil {
            add(specifier.Name(), false)
          }
        }
      case shimast.KindNamespaceImport:
        if namespace := clause.NamedBindings.AsNamespaceImport(); namespace != nil {
          add(namespace.Name(), true)
        }
      }

    case shimast.KindImportEqualsDeclaration:
      if declaration := node.AsImportEqualsDeclaration(); declaration != nil {
        add(declaration.Name(), false)
      }
    }
  })
  return imported, namespaces
}

// reportNoImportAssignTarget walks only the write positions of one assignment
// target. Object keys, computed keys, and default initializers are reads; member
// accesses are leaves so `ns.export.value = ...` remains allowed while a direct
// `ns.export = ...` write is reported.
func reportNoImportAssignTarget(
  ctx *Context,
  reportNode *shimast.Node,
  target *shimast.Node,
  imported map[*shimast.Symbol]string,
  namespaces map[*shimast.Symbol]string,
  allowBinding bool,
) {
  target = unwrapReferenceExpression(target)
  if target == nil {
    return
  }
  switch target.Kind {
  case shimast.KindIdentifier:
    if !allowBinding {
      return
    }
    if symbol := noImportAssignValueSymbol(ctx, target); symbol != nil {
      if name, ok := imported[symbol]; ok {
        ctx.Report(reportNode, "'"+name+"' is read-only.")
      }
    }

  case shimast.KindPropertyAccessExpression, shimast.KindElementAccessExpression:
    if name := noImportAssignDirectNamespaceName(ctx, target, namespaces); name != "" {
      ctx.Report(reportNode, "The members of '"+name+"' are read-only.")
    }

  case shimast.KindArrayLiteralExpression:
    if array := target.AsArrayLiteralExpression(); array != nil && array.Elements != nil {
      for _, element := range array.Elements.Nodes {
        reportNoImportAssignTarget(ctx, reportNode, element, imported, namespaces, allowBinding)
      }
    }

  case shimast.KindObjectLiteralExpression:
    if object := target.AsObjectLiteralExpression(); object != nil && object.Properties != nil {
      for _, property := range object.Properties.Nodes {
        reportNoImportAssignTarget(ctx, reportNode, property, imported, namespaces, allowBinding)
      }
    }

  case shimast.KindSpreadElement:
    if spread := target.AsSpreadElement(); spread != nil {
      reportNoImportAssignTarget(ctx, reportNode, spread.Expression, imported, namespaces, allowBinding)
    }

  case shimast.KindSpreadAssignment:
    if spread := target.AsSpreadAssignment(); spread != nil {
      reportNoImportAssignTarget(ctx, reportNode, spread.Expression, imported, namespaces, allowBinding)
    }

  case shimast.KindShorthandPropertyAssignment:
    if property := target.AsShorthandPropertyAssignment(); property != nil {
      reportNoImportAssignTarget(ctx, reportNode, property.Name(), imported, namespaces, allowBinding)
    }

  case shimast.KindPropertyAssignment:
    if property := target.AsPropertyAssignment(); property != nil {
      reportNoImportAssignTarget(ctx, reportNode, property.Initializer, imported, namespaces, allowBinding)
    }

  case shimast.KindBinaryExpression:
    expression := target.AsBinaryExpression()
    if expression != nil && expression.OperatorToken != nil &&
      expression.OperatorToken.Kind == shimast.KindEqualsToken {
      reportNoImportAssignTarget(ctx, reportNode, expression.Left, imported, namespaces, allowBinding)
    }
  }
}

func reportNoImportAssignMutationCall(
  ctx *Context,
  node *shimast.Node,
  namespaces map[*shimast.Symbol]string,
) {
  call := node.AsCallExpression()
  if call == nil || call.Arguments == nil || len(call.Arguments.Nodes) == 0 ||
    !isNoImportAssignMutationFunction(ctx, call.Expression) {
    return
  }
  target := unwrapReferenceExpression(call.Arguments.Nodes[0])
  if target == nil || target.Kind != shimast.KindIdentifier {
    return
  }
  if symbol := noImportAssignValueSymbol(ctx, target); symbol != nil {
    if name, ok := namespaces[symbol]; ok {
      ctx.Report(node, "The members of '"+name+"' are read-only.")
    }
  }
}

func isNoImportAssignMutationFunction(ctx *Context, callee *shimast.Node) bool {
  callee = unwrapReferenceExpression(callee)
  if callee == nil {
    return false
  }
  member, ok := referenceMemberParts(callee)
  if !ok || member.staticKey == nil {
    return false
  }
  object := unwrapReferenceExpression(member.object)
  if object == nil || object.Kind != shimast.KindIdentifier {
    return false
  }
  objectName := identifierText(object)
  allowed := false
  switch objectName {
  case "Object":
    switch *member.staticKey {
    case "assign", "defineProperty", "defineProperties", "freeze", "setPrototypeOf":
      allowed = true
    }
  case "Reflect":
    switch *member.staticKey {
    case "defineProperty", "deleteProperty", "set", "setPrototypeOf":
      allowed = true
    }
  }
  if !allowed {
    return false
  }

  resolved := noImportAssignValueSymbol(ctx, object)
  global := ctx.Checker.GetGlobalSymbol(objectName, shimast.SymbolFlagsValue, nil)
  if global != nil {
    global = ctx.Checker.GetMergedSymbol(global)
  }
  return resolved != nil && resolved == global
}

func noImportAssignDirectNamespaceName(
  ctx *Context,
  memberNode *shimast.Node,
  namespaces map[*shimast.Symbol]string,
) string {
  member, ok := referenceMemberParts(memberNode)
  if !ok {
    return ""
  }
  receiver := unwrapReferenceExpression(member.object)
  if receiver == nil || receiver.Kind != shimast.KindIdentifier {
    return ""
  }
  return namespaces[noImportAssignValueSymbol(ctx, receiver)]
}

// noImportAssignValueSymbol resolves shorthand destructuring targets through
// their value slot, then normalizes merged declarations to a stable map key.
// A type-only import used illegally as a value has no value-position symbol;
// in that case the checker's all-meanings entity lookup still returns the
// lexical import alias without falling back to textual name matching.
func noImportAssignValueSymbol(ctx *Context, identifier *shimast.Node) *shimast.Symbol {
  if ctx == nil || ctx.Checker == nil || identifier == nil {
    return nil
  }
  var symbol *shimast.Symbol
  shorthandTarget := false
  if parent := identifier.Parent; parent != nil && parent.Kind == shimast.KindShorthandPropertyAssignment {
    if shorthand := parent.AsShorthandPropertyAssignment(); shorthand != nil && shorthand.Name() == identifier {
      shorthandTarget = true
      symbol = ctx.Checker.GetShorthandAssignmentValueSymbol(parent)
    }
  }
  if symbol == nil && !shorthandTarget {
    symbol = ctx.Checker.GetSymbolAtLocation(identifier)
  }
  if symbol == nil {
    symbol = shimchecker.Checker_resolveEntityName(
      ctx.Checker,
      identifier,
      shimast.SymbolFlagsValue|shimast.SymbolFlagsType|shimast.SymbolFlagsNamespace,
      true,
      true,
      nil,
    )
  }
  if symbol == nil {
    return nil
  }
  return ctx.Checker.GetMergedSymbol(symbol)
}

func init() {
  Register(noImportAssign{})
}
