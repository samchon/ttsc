package graph

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// DecoratorArgument is one argument written on a decorator. Literal holds the
// statically-resolved value when the argument is a string or boolean literal
// and is nil otherwise.
type DecoratorArgument struct {
  Literal any
}

// Decorator is a decorator as written on a workspace declaration, captured so a
// consumer can interpret a decorator convention (`@Controller('users')`,
// `@Get(':id')`) without re-parsing source. Target is the id of the graph node
// the decorator is applied to; Pos/End bound the decorator for evidence.
type Decorator struct {
  Target    string
  Name      string
  Arguments []DecoratorArgument
  File      string
  Pos       int
  End       int
}

// collectDecorators records the decorators on each class plus its methods and
// properties, descending into namespace bodies. It is syntactic: a decorator's
// name and literal arguments are read straight from the AST because a consumer
// keys on the written convention name, not the resolved decorator symbol.
func (g *Graph) collectDecorators(path string, statements []*shimast.Node) {
  for _, statement := range statements {
    switch statement.Kind {
    case shimast.KindClassDeclaration:
      if id := topLevelID(path, statement, NodeClass); id != "" {
        g.nodeDecorators(id, path, statement)
      }
      g.memberDecorators(path, statement)
    case shimast.KindModuleDeclaration:
      g.collectDecorators(path, moduleStatements(statement))
    }
  }
}

// memberDecorators records the decorators on the methods and properties of a
// class declaration, attributed to their member nodes.
func (g *Graph) memberDecorators(path string, statement *shimast.Node) {
  for _, member := range classMembers(statement) {
    name := methodName(member.Symbol())
    if name == "" {
      continue
    }
    switch {
    case isMethodMember(member.Kind):
      g.nodeDecorators(nodeID(path, name, NodeMethod), path, member)
    case isPropertyMember(member.Kind):
      g.nodeDecorators(nodeID(path, name, NodeVariable), path, member)
    }
  }
}

// nodeDecorators appends a Decorator fact for every decorator on node, targeting
// the graph node identified by targetID.
func (g *Graph) nodeDecorators(targetID, path string, node *shimast.Node) {
  for _, dec := range node.Decorators() {
    fact := decoratorFact(dec)
    if fact == nil {
      continue
    }
    fact.Target = targetID
    fact.File = path
    g.Decorators = append(g.Decorators, fact)
  }
}

// decoratorFact reads a decorator node into a Decorator, or nil when its
// expression has no recoverable name. `@Get(':id')` yields name "Get" with one
// literal argument; a bare `@Injectable` yields name "Injectable" and no
// arguments.
func decoratorFact(dec *shimast.Node) *Decorator {
  decl := dec.AsDecorator()
  if decl == nil || decl.Expression == nil {
    return nil
  }
  fact := &Decorator{Pos: dec.Pos(), End: dec.End()}
  expr := decl.Expression
  if expr.Kind == shimast.KindCallExpression {
    call := expr.AsCallExpression()
    if call == nil || call.Expression == nil {
      return nil
    }
    fact.Name = shimast.NodeText(call.Expression)
    if call.Arguments != nil {
      for _, arg := range call.Arguments.Nodes {
        fact.Arguments = append(fact.Arguments, decoratorArg(arg))
      }
    }
  } else {
    fact.Name = shimast.NodeText(expr)
  }
  if fact.Name == "" {
    return nil
  }
  return fact
}

// decoratorArg captures one decorator argument. Only string and boolean
// literals resolve to a Literal, the values a consumer can use directly.
func decoratorArg(arg *shimast.Node) DecoratorArgument {
  out := DecoratorArgument{}
  switch arg.Kind {
  case shimast.KindStringLiteral, shimast.KindNoSubstitutionTemplateLiteral:
    out.Literal = arg.Text()
  case shimast.KindTrueKeyword:
    out.Literal = true
  case shimast.KindFalseKeyword:
    out.Literal = false
  }
  return out
}
