package graph

import shimast "github.com/microsoft/typescript-go/shim/ast"

// collectObjectMembers records the direct, statically named members of the
// object literal bound by declaration on the variable node Build already owns.
// The AST is the structure oracle: no source text, brace counter, or regex is
// involved in deciding which properties belong to the outer object.
func (g *Graph) collectObjectMembers(path string, declaration *shimast.Node) {
  if declaration == nil || declaration.Symbol() == nil {
    return
  }
  variable := declaration.AsVariableDeclaration()
  if variable == nil {
    return
  }
  object := objectLiteralInitializer(variable.Initializer)
  if object == nil || object.Properties == nil {
    return
  }
  node := g.Nodes[nodeID(path, qualifiedName(declaration.Symbol()), NodeVariable)]
  if node == nil {
    return
  }
  members := make([]ObjectMember, 0, len(object.Properties.Nodes))
  for _, property := range object.Properties.Nodes {
    name, kind, ok := objectMemberIdentity(property)
    if !ok {
      continue
    }
    signatureEnd, signatureBoundary, signatureTokenLen := objectMemberSignatureSpan(property)
    members = append(members, ObjectMember{
      Name:              name,
      Kind:              kind,
      Pos:               property.Pos(),
      End:               property.End(),
      SignatureEnd:      signatureEnd,
      SignatureBoundary: signatureBoundary,
      SignatureTokenLen: signatureTokenLen,
    })
  }
  if len(members) > 0 {
    node.ObjectMembers = members
  }
}

// objectMemberSignatureSpan finds the earliest AST boundary after which source
// belongs to a value body rather than the member outline. It keeps compact
// scalar initializers such as `real: 1`, but stops before function bodies,
// arrow expressions, nested object members, and array contents can be copied
// onto the wire.
func objectMemberSignatureSpan(property *shimast.Node) (end int, boundary bool, tokenLen int) {
  end = property.End()
  candidate, found := sourceBodyBoundary(property)
  if !found || candidate.end <= property.Pos() || candidate.end > end {
    return end, false, 0
  }
  return candidate.end, true, candidate.tokenLen
}

type signatureBoundary struct {
  end      int
  tokenLen int
}

func sourceBodyBoundary(node *shimast.Node) (signatureBoundary, bool) {
  if node == nil {
    return signatureBoundary{}, false
  }
  switch node.Kind {
  case shimast.KindArrowFunction:
    arrow := node.AsArrowFunction()
    if arrow != nil && arrow.EqualsGreaterThanToken != nil {
      return signatureBoundary{end: arrow.EqualsGreaterThanToken.End()}, true
    }
  case shimast.KindBlock, shimast.KindObjectLiteralExpression, shimast.KindArrayLiteralExpression:
    return signatureBoundary{end: node.Pos(), tokenLen: 1}, true
  case shimast.KindClassExpression:
    return signatureBoundary{end: node.Pos(), tokenLen: len("class")}, true
  }

  var boundary signatureBoundary
  found := false
  node.ForEachChild(func(child *shimast.Node) bool {
    candidate, ok := sourceBodyBoundary(child)
    if ok {
      boundary = candidate
      found = true
      // ForEachChild visits source order, so the first body boundary is the
      // earliest and later children cannot improve the outline cut.
      return true
    }
    return false
  })
  return boundary, found
}

// objectLiteralInitializer unwraps the transparent expression wrappers a
// declaration commonly places around an object literal. None changes which
// direct properties the literal declares.
func objectLiteralInitializer(initializer *shimast.Node) *shimast.ObjectLiteralExpression {
  for initializer != nil {
    switch initializer.Kind {
    case shimast.KindObjectLiteralExpression:
      return initializer.AsObjectLiteralExpression()
    case shimast.KindAsExpression:
      expression := initializer.AsAsExpression()
      if expression == nil {
        return nil
      }
      initializer = expression.Expression
    case shimast.KindSatisfiesExpression:
      expression := initializer.AsSatisfiesExpression()
      if expression == nil {
        return nil
      }
      initializer = expression.Expression
    case shimast.KindParenthesizedExpression:
      expression := initializer.AsParenthesizedExpression()
      if expression == nil {
        return nil
      }
      initializer = expression.Expression
    case shimast.KindTypeAssertionExpression:
      expression := initializer.AsTypeAssertion()
      if expression == nil {
        return nil
      }
      initializer = expression.Expression
    case shimast.KindNonNullExpression:
      expression := initializer.AsNonNullExpression()
      if expression == nil {
        return nil
      }
      initializer = expression.Expression
    default:
      return nil
    }
  }
  return nil
}

// objectMemberIdentity returns the source-visible name and details kind of one
// direct object-literal property. The boolean distinguishes an unsupported
// spread or dynamic computed key from the valid static property name `""`.
func objectMemberIdentity(property *shimast.Node) (string, NodeKind, bool) {
  if property == nil {
    return "", "", false
  }
  kind := NodeVariable
  switch property.Kind {
  case shimast.KindPropertyAssignment, shimast.KindShorthandPropertyAssignment:
  case shimast.KindMethodDeclaration, shimast.KindGetAccessor, shimast.KindSetAccessor:
    kind = NodeMethod
  default:
    return "", "", false
  }
  name, ok := staticObjectMemberName(property.Name())
  return name, kind, ok
}

// staticObjectMemberName resolves the declaration forms whose property name is
// fixed by syntax. A computed literal is fixed; a computed expression is not.
func staticObjectMemberName(name *shimast.Node) (string, bool) {
  if name == nil {
    return "", false
  }
  switch name.Kind {
  case shimast.KindIdentifier:
    if identifier := name.AsIdentifier(); identifier != nil {
      return identifier.Text, true
    }
  case shimast.KindStringLiteral:
    if literal := name.AsStringLiteral(); literal != nil {
      return literal.Text, true
    }
  case shimast.KindNoSubstitutionTemplateLiteral:
    if literal := name.AsNoSubstitutionTemplateLiteral(); literal != nil {
      return literal.Text, true
    }
  case shimast.KindNumericLiteral:
    if literal := name.AsNumericLiteral(); literal != nil {
      return literal.Text, true
    }
  case shimast.KindBigIntLiteral:
    if literal := name.AsBigIntLiteral(); literal != nil {
      return literal.Text, true
    }
  case shimast.KindComputedPropertyName:
    computed := name.AsComputedPropertyName()
    if computed == nil {
      return "", false
    }
    return staticComputedObjectMemberName(computed.Expression)
  }
  return "", false
}

func staticComputedObjectMemberName(expression *shimast.Node) (string, bool) {
  for expression != nil && expression.Kind == shimast.KindParenthesizedExpression {
    parenthesized := expression.AsParenthesizedExpression()
    if parenthesized == nil {
      return "", false
    }
    expression = parenthesized.Expression
  }
  if expression == nil {
    return "", false
  }
  switch expression.Kind {
  case shimast.KindStringLiteral:
    if literal := expression.AsStringLiteral(); literal != nil {
      return literal.Text, true
    }
  case shimast.KindNoSubstitutionTemplateLiteral:
    if literal := expression.AsNoSubstitutionTemplateLiteral(); literal != nil {
      return literal.Text, true
    }
  case shimast.KindNumericLiteral:
    if literal := expression.AsNumericLiteral(); literal != nil {
      return literal.Text, true
    }
  case shimast.KindBigIntLiteral:
    if literal := expression.AsBigIntLiteral(); literal != nil {
      return literal.Text, true
    }
  }
  return "", false
}
