package evidence

import (
  "path"
  "sort"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// singularRule enforces that a file declares exactly one public identity and
// takes that identity's name.
//
// The unit counted is an identity, not an export. TypeScript declaration
// merging exposes one name through several declarations — `export interface I`
// beside `export namespace I`, `export const x` beside `export default x` — and
// every one of those forms is a single identity here, so the permitted merges
// fall out of what is counted rather than being carved out of it.
type singularRule struct{}

func (singularRule) Name() string { return singularRuleName }

func (singularRule) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}

func (singularRule) NeedsTypeChecker() bool { return false }

func (singularRule) VisitsDeclarationFiles() bool { return false }

func (singularRule) AcceptsTtscLintOptions() bool { return false }

func (singularRule) Check(ctx *rule.Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil || node == nil {
    return
  }
  if node.Kind != shimast.KindSourceFile {
    return
  }
  surface := collectPublicSurface(ctx.File)
  content := ctx.File.Text()

  // One finding per file, most structural first. A file that declares two
  // identities has to be split before its name can mean anything, and an
  // anonymous default has to be named before a name can be compared.
  if len(surface.Identities) > 1 {
    ctx.Report(
      surface.Identities[1].Node,
      "A file declares exactly one public identity, but this one declares "+
        decimal(len(surface.Identities))+": "+
        describeIdentities(surface.Identities, content)+
        ". Move every extra identity to its own file, or re-export them from a barrel; merged declarations of one name count once.",
    )
    return
  }
  if surface.AnonymousDefault != nil {
    ctx.Report(
      surface.AnonymousDefault,
      "An anonymous default export has no name for its file to take. Name the exported declaration, or export a named declaration instead of an anonymous default.",
    )
    return
  }
  if len(surface.Identities) == 0 {
    return
  }

  base, extension := splitModuleBaseName(ctx.File.FileName().AsString())
  if base == "index" {
    return
  }
  identity := surface.Identities[0]
  names := identity.matchable()
  for _, name := range names {
    if name == base {
      return
    }
  }
  ctx.Report(
    identity.Node,
    "A file takes the name of its public identity, but '"+base+extension+
      "' declares '"+strings.Join(names, "' / '")+"'. Rename the file to '"+
      names[0]+extension+"', or rename the identity to '"+base+"'.",
  )
}

func init() { rule.Register(singularRule{}) }

// publicIdentity is one locally declared name that this file exposes.
//
// Addresses holds the public names a consumer can import, which is what the
// file name must match. It excludes `default`, which names no identity: a file
// whose only exposure is `export default x` is still the file of `x`.
type publicIdentity struct {
  Local     string
  Addresses []string
  Node      *shimast.Node
}

func (identity publicIdentity) matchable() []string {
  if len(identity.Addresses) != 0 {
    return identity.Addresses
  }
  return []string{identity.Local}
}

type publicSurface struct {
  Identities       []publicIdentity
  AnonymousDefault *shimast.Node
}

// collectPublicSurface reduces a source file's top-level statements to the
// identities it owns.
//
// Ownership is declaration ownership, never mere re-exposure. An export
// declaration carrying a module specifier declares nothing here, so a barrel
// owns no identity and needs no exemption; an export list or default assignment
// naming an import binding is the same case one step removed.
func collectPublicSurface(file *shimast.SourceFile) publicSurface {
  surface := publicSurface{}
  if file == nil || file.Statements == nil {
    return surface
  }
  order := []string{}
  nodes := map[string]*shimast.Node{}
  addresses := map[string]map[string]bool{}
  owned := map[string]bool{}

  declare := func(name string, node *shimast.Node) {
    if name == "" {
      return
    }
    if _, exists := nodes[name]; !exists {
      order = append(order, name)
      nodes[name] = node
      addresses[name] = map[string]bool{}
    }
  }
  expose := func(local string, public string) {
    if _, exists := nodes[local]; !exists {
      return
    }
    owned[local] = true
    if public != "" {
      addresses[local][public] = true
    }
  }

  for _, statement := range file.Statements.Nodes {
    if statement == nil {
      continue
    }
    for _, declared := range topLevelDeclaredNames(statement) {
      declare(declared.Name, declared.Node)
    }
  }
  for _, statement := range file.Statements.Nodes {
    if statement == nil {
      continue
    }
    switch statement.Kind {
    case shimast.KindExportDeclaration:
      for _, alias := range localExportAliases(statement) {
        expose(alias.Local, alias.Public)
      }
    case shimast.KindExportAssignment:
      assignment := statement.AsExportAssignment()
      if assignment == nil {
        continue
      }
      local := ""
      if assignment.Expression != nil &&
        assignment.Expression.Kind == shimast.KindIdentifier {
        local = declarationName(assignment.Expression)
      }
      if local == "" || nodes[local] == nil {
        // `export default 1` and `export default fromAnotherModule` both
        // expose something this file cannot be named after.
        if local == "" {
          surface.AnonymousDefault = statement
        }
        continue
      }
      expose(local, "")
    default:
      if !isSyntacticallyExported(statement) {
        continue
      }
      declared := topLevelDeclaredNames(statement)
      for _, name := range declared {
        expose(name.Name, name.Name)
      }
      if len(declared) == 0 && isDefaultExported(statement) {
        surface.AnonymousDefault = statement
      }
    }
  }

  for _, local := range order {
    if !owned[local] {
      continue
    }
    public := make([]string, 0, len(addresses[local]))
    for name := range addresses[local] {
      public = append(public, name)
    }
    sort.Strings(public)
    surface.Identities = append(surface.Identities, publicIdentity{
      Local:     local,
      Addresses: public,
      Node:      nodes[local],
    })
  }
  return surface
}

// declaredName pairs a module-scope name with the identifier that spells it.
//
// The identifier is kept rather than the statement because both the reported
// range and the reported line come from it. A statement's own position starts
// before its leading trivia, so anchoring there underlines the blank line above
// the declaration and names the wrong line in the message.
type declaredName struct {
  Name string
  Node *shimast.Node
}

// topLevelDeclaredNames returns the names a statement declares in module scope.
//
// Only identifier names qualify. A module declaration named by a string literal
// is an augmentation of another module rather than an identity of this one, and
// counting it would report every ambient declaration file as an extra identity.
func topLevelDeclaredNames(statement *shimast.Node) []declaredName {
  switch statement.Kind {
  case shimast.KindInterfaceDeclaration,
    shimast.KindTypeAliasDeclaration,
    shimast.KindFunctionDeclaration,
    shimast.KindClassDeclaration,
    shimast.KindEnumDeclaration,
    shimast.KindModuleDeclaration:
    name := statement.Name()
    if name == nil || name.Kind != shimast.KindIdentifier {
      return nil
    }
    if declared := declarationName(name); declared != "" {
      return []declaredName{{Name: declared, Node: name}}
    }
    return nil
  case shimast.KindVariableStatement:
    variable := statement.AsVariableStatement()
    if variable == nil || variable.DeclarationList == nil {
      return nil
    }
    list := variable.DeclarationList.AsVariableDeclarationList()
    if list == nil || list.Declarations == nil {
      return nil
    }
    names := []declaredName{}
    for _, declaration := range list.Declarations.Nodes {
      if declaration == nil {
        continue
      }
      for _, binding := range bindingIdentifierNodes(declaration.Name()) {
        if name := declarationName(binding); name != "" {
          names = append(names, declaredName{Name: name, Node: binding})
        }
      }
    }
    return names
  default:
    return nil
  }
}

// exportAlias is one entry of an export list: the local declaration it names,
// and the public name it gives that declaration.
//
// Public is empty for `export { x as default }`, which exposes `x` without
// giving it an addressable name — the same state `export default x` produces.
type exportAlias struct {
  Local  string
  Public string
}

// localExportAliases lists the exposures an export list creates, skipping any
// list that re-exports from another module.
//
// The result is a slice rather than a local-keyed map because one local may be
// exported under several names. Collapsing those to one would drop every name
// but the last, and a file legitimately named after a dropped name would then
// be reported.
func localExportAliases(statement *shimast.Node) []exportAlias {
  aliases := []exportAlias{}
  declaration := statement.AsExportDeclaration()
  if declaration == nil ||
    declaration.ModuleSpecifier != nil ||
    declaration.ExportClause == nil ||
    declaration.ExportClause.Kind != shimast.KindNamedExports {
    return aliases
  }
  named := declaration.ExportClause.AsNamedExports()
  if named == nil || named.Elements == nil {
    return aliases
  }
  for _, element := range named.Elements.Nodes {
    if element == nil || element.Kind != shimast.KindExportSpecifier {
      continue
    }
    specifier := element.AsExportSpecifier()
    if specifier == nil {
      continue
    }
    localNode := specifier.PropertyName
    if localNode == nil {
      localNode = specifier.Name()
    }
    local := declarationName(localNode)
    public := declarationName(specifier.Name())
    if local == "" || public == "" {
      continue
    }
    if public == "default" {
      public = ""
    }
    aliases = append(aliases, exportAlias{Local: local, Public: public})
  }
  return aliases
}

func isDefaultExported(node *shimast.Node) bool {
  return node != nil &&
    shimast.GetCombinedModifierFlags(node)&shimast.ModifierFlagsDefault != 0
}

// splitModuleBaseName separates a module's base name from its final extension.
//
// Only the final extension is removed. A dotted infix such as `foo.test.ts`
// keeps `foo.test`, which no identifier can equal, so such a file is reported
// rather than silently matched against a prefix of itself.
func splitModuleBaseName(fileName string) (string, string) {
  base := path.Base(strings.ReplaceAll(fileName, "\\", "/"))
  extension := path.Ext(base)
  return strings.TrimSuffix(base, extension), extension
}

func describeIdentities(identities []publicIdentity, content string) string {
  described := make([]string, 0, len(identities))
  for _, identity := range identities {
    described = append(
      described,
      "'"+strings.Join(identity.matchable(), "' / '")+"' (line "+
        decimal(lineAt(content, identityOffset(identity.Node)))+")",
    )
  }
  return strings.Join(described, ", ")
}

// identityOffset points at the last character of a declared name.
//
// A node's own start position sits before its leading trivia, so the end is
// what keeps a reported line on the declaration rather than on the blank line
// above it.
func identityOffset(node *shimast.Node) int {
  if node == nil || node.End() <= 0 {
    return 0
  }
  return node.End() - 1
}
