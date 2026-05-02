package main

import shimast "github.com/microsoft/typescript-go/shim/ast"

// no-duplicate-case: duplicated `case` labels in a single switch.
// https://eslint.org/docs/latest/rules/no-duplicate-case
type noDuplicateCase struct{}

func (noDuplicateCase) Name() string           { return "no-duplicate-case" }
func (noDuplicateCase) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSwitchStatement} }
func (noDuplicateCase) Check(ctx *Context, node *shimast.Node) {
  sw := node.AsSwitchStatement()
  if sw == nil || sw.CaseBlock == nil {
    return
  }
  block := sw.CaseBlock.AsCaseBlock()
  if block == nil || block.Clauses == nil {
    return
  }
  seen := make(map[string]bool, len(block.Clauses.Nodes))
  for _, clause := range block.Clauses.Nodes {
    if clause == nil || clause.Kind != shimast.KindCaseClause {
      continue
    }
    caseClause := clause.AsCaseOrDefaultClause()
    if caseClause == nil || caseClause.Expression == nil {
      continue
    }
    key := nodeText(ctx.File, caseClause.Expression)
    if key == "" {
      continue
    }
    if seen[key] {
      ctx.Report(clause, "Duplicate case label.")
      continue
    }
    seen[key] = true
  }
}

// no-dupe-keys: duplicated property names in a single object literal.
// https://eslint.org/docs/latest/rules/no-dupe-keys
type noDupeKeys struct{}

func (noDupeKeys) Name() string           { return "no-dupe-keys" }
func (noDupeKeys) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindObjectLiteralExpression} }
func (noDupeKeys) Check(ctx *Context, node *shimast.Node) {
  obj := node.AsObjectLiteralExpression()
  if obj == nil || obj.Properties == nil {
    return
  }
  seen := make(map[string]*shimast.Node, len(obj.Properties.Nodes))
  for _, prop := range obj.Properties.Nodes {
    key := propertyKey(ctx.File, prop)
    if key == "" {
      continue
    }
    if first, ok := seen[key]; ok {
      ctx.Report(prop, "Duplicate key '"+key+"'.")
      _ = first
      continue
    }
    seen[key] = prop
  }
}

// no-dupe-args: duplicated parameter names in a single function head.
// https://eslint.org/docs/latest/rules/no-dupe-args
type noDupeArgs struct{}

func (noDupeArgs) Name() string { return "no-dupe-args" }
func (noDupeArgs) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindFunctionDeclaration,
    shimast.KindFunctionExpression,
    shimast.KindArrowFunction,
    shimast.KindMethodDeclaration,
    shimast.KindConstructor,
    shimast.KindGetAccessor,
    shimast.KindSetAccessor,
  }
}
func (noDupeArgs) Check(ctx *Context, node *shimast.Node) {
  params := node.Parameters()
  seen := make(map[string]bool, len(params))
  for _, param := range params {
    paramDecl := param.AsParameterDeclaration()
    if paramDecl == nil {
      continue
    }
    name := identifierText(paramDecl.Name())
    if name == "" {
      continue
    }
    if seen[name] {
      ctx.Report(param, "Duplicate parameter name '"+name+"'.")
      continue
    }
    seen[name] = true
  }
}

// propertyKey returns a stable key for a property in an object literal.
// Computed names without a literal payload return "" so the dedupe pass
// can skip them safely (a typed field is fine — duplicate identical
// expressions still won't cause false positives because the same expr
// produces the same source text).
func propertyKey(file *shimast.SourceFile, prop *shimast.Node) string {
  if prop == nil {
    return ""
  }
  switch prop.Kind {
  case shimast.KindPropertyAssignment:
    assignment := prop.AsPropertyAssignment()
    if assignment == nil {
      return ""
    }
    return staticPropertyKey(file, assignment.Name())
  case shimast.KindShorthandPropertyAssignment:
    short := prop.AsShorthandPropertyAssignment()
    if short == nil {
      return ""
    }
    return staticPropertyKey(file, short.Name())
  case shimast.KindMethodDeclaration:
    method := prop.AsMethodDeclaration()
    if method == nil {
      return ""
    }
    return staticPropertyKey(file, method.Name())
  case shimast.KindGetAccessor, shimast.KindSetAccessor:
    // Getter and setter pairs share a name but are not duplicates.
    // Add a kind suffix so the dedupe key separates them.
    switch prop.Kind {
    case shimast.KindGetAccessor:
      get := prop.AsGetAccessorDeclaration()
      if get == nil {
        return ""
      }
      if k := staticPropertyKey(file, get.Name()); k != "" {
        return "get:" + k
      }
    case shimast.KindSetAccessor:
      set := prop.AsSetAccessorDeclaration()
      if set == nil {
        return ""
      }
      if k := staticPropertyKey(file, set.Name()); k != "" {
        return "set:" + k
      }
    }
  }
  return ""
}

func staticPropertyKey(file *shimast.SourceFile, name *shimast.Node) string {
  if name == nil {
    return ""
  }
  switch name.Kind {
  case shimast.KindIdentifier:
    return identifierText(name)
  case shimast.KindStringLiteral, shimast.KindNoSubstitutionTemplateLiteral:
    return stringLiteralText(name)
  case shimast.KindNumericLiteral, shimast.KindBigIntLiteral:
    return numericLiteralText(name)
  case shimast.KindComputedPropertyName:
    // fall back to source text so a computed `[`foo`]` still compares
    // against the literal `foo` form when both appear together.
    return nodeText(file, name)
  }
  return ""
}

func init() {
  Register(noDuplicateCase{})
  Register(noDupeKeys{})
  Register(noDupeArgs{})
}
