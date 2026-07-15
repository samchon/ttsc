package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

// noDuplicateCase: duplicated `case` labels in a single switch.
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

// noDupeKeys: duplicated property names in a single object literal.
// https://eslint.org/docs/latest/rules/no-dupe-keys
type noDupeKeys struct{}

func (noDupeKeys) Name() string           { return "no-dupe-keys" }
func (noDupeKeys) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindObjectLiteralExpression} }
func (noDupeKeys) Check(ctx *Context, node *shimast.Node) {
  obj := node.AsObjectLiteralExpression()
  if obj == nil || obj.Properties == nil {
    return
  }
  seen := make(map[string]bool, len(obj.Properties.Nodes))
  for _, prop := range obj.Properties.Nodes {
    key := propertyKey(ctx.File, prop)
    if key == "" {
      continue
    }
    if seen[key] {
      ctx.Report(prop, "Duplicate key '"+key+"'.")
      continue
    }
    seen[key] = true
  }
}

// noDupeArgs: duplicated parameter names in a single function head.
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

// propertyKey returns a stable dedupe key for a property in an object literal,
// mirroring ESLint's getStaticPropertyName. A property whose name is not
// statically known — a computed name built from a non-constant expression —
// returns "" so the dedupe pass skips it and never treats two distinct dynamic
// keys as duplicates.
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

// staticPropertyKey extracts a comparable string key from a property name node,
// mirroring ESLint's getStaticPropertyName. A bare identifier yields its name,
// and string / numeric / bigint literals yield their text. A computed name
// yields a key only when its bracketed expression is itself a constant literal
// (resolved like getStaticStringValue): `["a"]` resolves to `a` so it collides
// with the identifier key `a`, while a non-constant computed name such as
// `[f()]` or `[x]` resolves to "" and the caller skips it. The file argument is
// unused here but kept so the whole property-key family shares one signature.
func staticPropertyKey(_ *shimast.SourceFile, name *shimast.Node) string {
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
    computed := name.AsComputedPropertyName()
    if computed == nil {
      return ""
    }
    return staticComputedKey(computed.Expression)
  }
  return ""
}

// staticComputedKey resolves the expression inside a `[...]` computed property
// name to a static key, mirroring ESLint's getStaticStringValue: only a
// constant literal (string, template without substitutions, numeric, or bigint)
// contributes a key. Parentheses are transparent, matching ESTree, which has no
// parenthesized-expression node. Any other expression contributes "".
func staticComputedKey(expr *shimast.Node) string {
  expr = stripParens(expr)
  if expr == nil {
    return ""
  }
  switch expr.Kind {
  case shimast.KindStringLiteral, shimast.KindNoSubstitutionTemplateLiteral:
    return stringLiteralText(expr)
  case shimast.KindNumericLiteral, shimast.KindBigIntLiteral:
    return numericLiteralText(expr)
  }
  return ""
}

func init() {
  Register(noDuplicateCase{})
  Register(noDupeKeys{})
  Register(noDupeArgs{})
}
