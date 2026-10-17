package graph

import shimast "github.com/microsoft/typescript-go/shim/ast"

// structuralMemberName replaces anonymous type/class binder containers with
// the declaration that names them. An unbound literal has no stable owner.
func structuralMemberName(symbol *shimast.Symbol) (string, bool) {
  if symbol == nil {
    return "", false
  }
  for _, declaration := range symbol.Declarations {
    parent := declaration.Parent
    if parent == nil {
      continue
    }
    var owner string
    switch {
    case parent.Kind == shimast.KindTypeLiteral:
      owner = typeLiteralOwner(parent)
    case parent.Kind == shimast.KindClassExpression:
      owner = classExpressionOwner(parent)
    case isParameterProperty(declaration):
      class := parent.Parent
      if class != nil && class.Kind == shimast.KindClassExpression {
        owner = classExpressionOwner(class)
      } else if class != nil && class.Symbol() != nil {
        owner = qualifiedName(class.Symbol())
      }
    }
    if owner != "" {
      return appendObjectMemberName(owner, simpleName(symbol)), true
    }
  }
  return "", false
}

// typeLiteralOwner follows only type structure with a named declaration owner;
// a function return or parameter type is not a property of that function.
func typeLiteralOwner(literal *shimast.Node) string {
  for node := literal.Parent; node != nil; node = node.Parent {
    switch node.Kind {
    case shimast.KindUnionType, shimast.KindIntersectionType, shimast.KindParenthesizedType:
      continue
    case shimast.KindTypeAliasDeclaration, shimast.KindPropertySignature, shimast.KindPropertyDeclaration:
      if node.Symbol() != nil {
        return qualifiedName(node.Symbol())
      }
    }
    break
  }
  return ""
}

// typeLiteralMembers enumerates statically owned literal members once in AST
// order, including literals nested under named properties and intersections.
func typeLiteralMembers(typeNode *shimast.Node) []*shimast.Node {
  if typeNode == nil {
    return nil
  }
  var members []*shimast.Node
  var walk func(*shimast.Node)
  walk = func(node *shimast.Node) {
    if node.Kind == shimast.KindTypeLiteral {
      literal := node.AsTypeLiteralNode()
      if typeLiteralOwner(node) == "" || literal.Members == nil {
        return
      }
      for _, member := range literal.Members.Nodes {
        if _, ok := staticObjectMemberName(member.Name()); !ok {
          continue
        }
        members = append(members, member)
        walkType := member.Type()
        if walkType != nil {
          walk(walkType)
        }
      }
      return
    }
    switch node.Kind {
    case shimast.KindUnionType, shimast.KindIntersectionType, shimast.KindParenthesizedType:
      node.ForEachChild(func(child *shimast.Node) bool { walk(child); return false })
    }
  }
  walk(typeNode)
  return members
}

// isParameterProperty admits constructor parameters with a property modifier,
// leaving ordinary parameters local to their constructor.
func isParameterProperty(node *shimast.Node) bool {
  return node.Kind == shimast.KindParameter && node.Parent != nil && node.Parent.Kind == shimast.KindConstructor &&
    shimast.GetCombinedModifierFlags(node)&shimast.ModifierFlagsParameterPropertyModifier != 0
}

// boundClassExpression unwraps the transparent expression forms around a
// variable's class initializer, without guessing classes returned by factories.
func boundClassExpression(binding *shimast.Node) *shimast.Node {
  variable := binding.AsVariableDeclaration()
  if variable == nil {
    return nil
  }
  node := variable.Initializer
  for node != nil {
    switch node.Kind {
    case shimast.KindClassExpression:
      return node
    case shimast.KindParenthesizedExpression, shimast.KindAsExpression, shimast.KindSatisfiesExpression,
      shimast.KindTypeAssertionExpression, shimast.KindNonNullExpression:
      node = node.Expression()
    default:
      return nil
    }
  }
  return nil
}

// classExpressionOwner uses the outer binding even for a named expression;
// its internal class name is private to that expression's body.
func classExpressionOwner(expression *shimast.Node) string {
  if binding := classExpressionBinding(expression); binding != nil {
    return qualifiedName(binding.Symbol())
  }
  return ""
}

// classExpressionBinding preserves the actual declaration behind an owner
// name, so a shadowing local cannot borrow a same-named indexed value.
func classExpressionBinding(expression *shimast.Node) *shimast.Node {
  for parent := expression.Parent; parent != nil; parent = parent.Parent {
    switch parent.Kind {
    case shimast.KindParenthesizedExpression, shimast.KindAsExpression, shimast.KindSatisfiesExpression,
      shimast.KindTypeAssertionExpression, shimast.KindNonNullExpression:
      continue
    case shimast.KindVariableDeclaration:
      if parent.Symbol() != nil && boundClassExpression(parent) == expression {
        return parent
      }
    }
    break
  }
  return nil
}
