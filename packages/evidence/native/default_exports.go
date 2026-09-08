package evidence

import shimast "github.com/microsoft/typescript-go/shim/ast"

// Default aliases retain the named declaration's identity. Anonymous class
// and function declarations own the module's default identity directly.
func typeScriptDeclarationName(node *shimast.Node) string {
  if node == nil {
    return ""
  }
  if name := declarationName(node.Name()); name != "" {
    return name
  }
  if isDefaultExported(node) {
    return "default"
  }
  return ""
}

func collectDefaultExportBindings(statements *shimast.NodeList) map[string]exportedName {
  bindings := map[string]exportedName{}
  if statements == nil {
    return bindings
  }
  for _, statement := range statements.Nodes {
    if statement == nil {
      continue
    }
    if statement.Kind == shimast.KindExportAssignment {
      assignment := statement.AsExportAssignment()
      expression := assignment.Expression
      if !assignment.IsExportEquals && expression != nil && expression.Kind == shimast.KindIdentifier {
        local := declarationName(expression)
        bindings[local] = exportedName{Public: local}
      }
    }
    if statement.Kind != shimast.KindExportDeclaration {
      continue
    }
    declaration := statement.AsExportDeclaration()
    if declaration.ModuleSpecifier != nil || declaration.ExportClause == nil || declaration.ExportClause.Kind != shimast.KindNamedExports {
      continue
    }
    for _, element := range declaration.ExportClause.AsNamedExports().Elements.Nodes {
      specifier := element.AsExportSpecifier()
      if declarationName(specifier.Name()) != "default" {
        continue
      }
      local := specifier.PropertyName
      if local == nil {
        local = specifier.Name()
      }
      name := declarationName(local)
      typeOnly := declaration.IsTypeOnly || specifier.IsTypeOnly
      if previous, exists := bindings[name]; exists {
        typeOnly = typeOnly && previous.TypeOnly
      }
      bindings[name] = exportedName{Public: name, TypeOnly: typeOnly}
    }
  }
  return bindings
}
