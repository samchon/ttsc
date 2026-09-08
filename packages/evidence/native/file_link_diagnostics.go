package evidence

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  "sort"
)

// Diagnostic inspection never creates an obligation. It distinguishes a
// declaration the collector intentionally withheld from a misspelled address.
func diagnoseFileLinkTarget(loader *typeScriptLoader, module string, segments []string, where string) string {
  inventory := loader.inventory(module)
  if inventory == nil {
    return "Unreadable TypeScript evidence target" + where + ": " + loader.failure(module) + ". Restore the configured source file."
  }
  all := materializeEntryUnits(loader, []string{module}, symbolSet{"type": true, "function": true, "property": true})
  for _, address := range all.Published {
    if encodeTypeScriptIdentity(address.Segments) == encodeTypeScriptIdentity(segments) {
      return "Unselected TypeScript evidence target" + where + ": the declaration exists but this reference's files or symbol selection does not admit it. Select its symbol kind or cite a selected declaration."
    }
  }
  exports := traverseEntryExports(loader, module, nil, map[string]bool{}, false)
  sort.SliceStable(exports, func(left, right int) bool { return len(exports[left].Address) > len(exports[right].Address) })
  for _, exported := range exports {
    if exported.Local == "" {
      continue
    }
    if len(exported.Address) > len(segments) {
      continue
    }
    if encodeTypeScriptIdentity(exported.Address) != encodeTypeScriptIdentity(segments[:len(exported.Address)]) {
      continue
    }
    source := loader.inventory(exported.Path)
    if source == nil || source.Source == nil {
      continue
    }
    local := exported.Local
    // Inventories use public local aliases, while the AST uses bindings.
    for _, entry := range source.Exports {
      if entry.Specifier == "" && entry.Public == local && entry.Local != "" {
        local = entry.Local
        break
      }
    }
    tail := append([]string{local}, segments[len(exported.Address):]...)
    if exported.TypeOnly {
      identity := append([]string{exported.Local}, segments[len(exported.Address):]...)
      for _, unit := range source.Units {
        if unit.ValueSpace && !unit.TypeSpace && encodeTypeScriptIdentity(unit.Identity) == encodeTypeScriptIdentity(identity) {
          return "Type-only TypeScript evidence target" + where + ": this export exposes no value through which the member can be addressed. Use a public value export or cite its type."
        }
      }
    }
    if cause := inspectUnavailableDeclaration(source.Source.Statements, tail); cause != "" {
      return "Unsupported TypeScript evidence target" + where + ": " + cause + ". Cite a supported public declaration."
    }
    if len(segments) > len(exported.Address) {
      return "Missing TypeScript evidence member" + where + ": the exported declaration has no addressable member '" + formatFileAccessor(segments[len(exported.Address):]) + "'. Correct the member name and use '.prototype' for an instance member."
    }
    return "Unsupported TypeScript evidence declaration" + where + ": the export is not a supported type, function, or property unit. Cite a supported declaration."
  }
  if inventory.Source != nil && inventory.Source.Statements != nil {
    for _, statement := range inventory.Source.Statements.Nodes {
      if statement == nil {
        continue
      }
      for _, declared := range topLevelDeclaredNames(statement) {
        if declared.Name == segments[0] {
          return "Unexported TypeScript evidence declaration" + where + ": '" + segments[0] + "' is a local binding, not a public export of this module. Use its public alias or default export."
        }
      }
    }
  }
  if cause := inspectUnavailableDeclaration(inventory.Source.Statements, segments); cause != "" {
    return "Unsupported TypeScript evidence target" + where + ": " + cause + ". Export a supported declaration or correct the target."
  }
  return "Missing TypeScript evidence export" + where + ": the module exports no declaration named '" + segments[0] + "'. Use its public export name or correct the file."
}

func inspectUnavailableDeclaration(statements *shimast.NodeList, segments []string) string {
  if statements == nil || len(segments) == 0 {
    return ""
  }
  for _, statement := range statements.Nodes {
    if statement == nil {
      continue
    }
    if typeScriptDeclarationName(statement) != segments[0] {
      continue
    }
    if len(segments) == 1 {
      if !isSyntacticallyExported(statement) {
        return "the declaration is not exported"
      }
      return "the declaration form is not supported by the evidence unit model"
    }
    tail := segments[1:]
    var members *shimast.NodeList
    class := statement.Kind == shimast.KindClassDeclaration
    switch statement.Kind {
    case shimast.KindClassDeclaration:
      members = statement.AsClassDeclaration().Members
    case shimast.KindInterfaceDeclaration:
      members = statement.AsInterfaceDeclaration().Members
    case shimast.KindTypeAliasDeclaration:
      node := statement.AsTypeAliasDeclaration().Type
      if node != nil && node.Kind == shimast.KindTypeLiteral {
        members = node.AsTypeLiteralNode().Members
      }
    case shimast.KindModuleDeclaration:
      body := statement.AsModuleDeclaration().Body
      if body != nil && body.Kind == shimast.KindModuleBlock {
        return inspectUnavailableDeclaration(body.AsModuleBlock().Statements, tail)
      }
    }
    instance := class && len(tail) > 1 && tail[0] == "prototype"
    if instance {
      tail = tail[1:]
    }
    if members == nil || len(tail) != 1 {
      continue
    }
    for _, member := range members.Nodes {
      if member != nil && member.Kind == shimast.KindConstructor && instance {
        for _, parameter := range member.Parameters() {
          if parameter != nil && isParameterProperty(parameter) && declarationName(parameter.Name()) == tail[0] && !isPublicClassMember(parameter) {
            return "the member is private or protected"
          }
        }
      }
      if member == nil || member.Name() == nil {
        continue
      }
      name := member.Name()
      if name.Kind != shimast.KindIdentifier && name.Kind != shimast.KindPrivateIdentifier && name.Kind != shimast.KindStringLiteral && name.Kind != shimast.KindNumericLiteral {
        continue
      }
      if name.Text() != tail[0] {
        continue
      }
      if class {
        static := shimast.GetCombinedModifierFlags(member)&shimast.ModifierFlagsStatic != 0
        if static == instance {
          continue
        }
        if !isPublicClassMember(member) || name.Kind == shimast.KindPrivateIdentifier {
          return "the member is private or protected"
        }
      }
      if member.Kind == shimast.KindGetAccessor || member.Kind == shimast.KindSetAccessor || member.ModifierFlags()&shimast.ModifierFlagsAccessor != 0 {
        return "accessors are not evidence units"
      }
      return "the member is not exposed as a supported public evidence unit"
    }
  }
  return ""
}
