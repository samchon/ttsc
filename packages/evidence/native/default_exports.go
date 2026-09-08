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

func collectDefaultExportBindings(statements *shimast.NodeList) map[string]bool {
  bindings := map[string]bool{}
  if statements == nil {
    return bindings
  }
  for _, statement := range statements.Nodes {
    if statement == nil {
      continue
    }
    if statement.Kind == shimast.KindExportAssignment {
      expression := statement.AsExportAssignment().Expression
      if expression != nil && expression.Kind == shimast.KindIdentifier {
        bindings[declarationName(expression)] = true
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
      bindings[declarationName(local)] = true
    }
  }
  return bindings
}
