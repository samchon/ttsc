package evidence

import (
  "sort"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// moduleExport is one name a module offers to whoever imports it.
//
// A local export names a declaration in this file; a re-export names one in
// another. Keeping the two apart is what lets identity stay with the declaring
// file while reachability is decided by whoever re-exports it.
type moduleExport struct {
  // Public is the name an importer sees. Empty for `export * from`, which
  // contributes its target's names rather than a name of its own.
  Public string
  // Local is the declaration's own name in this file, empty for a re-export.
  Local string
  // Specifier is the module a re-export pulls from, empty for a local export.
  Specifier string
  // Imported is the name taken from that module, empty for a star re-export.
  Imported string
  // Namespace marks `export * as ns from`, which nests the target's whole
  // surface one segment deeper instead of flattening it.
  Namespace bool
  // TypeOnly marks an export that carries only the type side of what it names,
  // written either as `export type { X }` or as `export { type X }`.
  //
  // A local export list already reaches the collector's own projection guard,
  // so this field exists for the half that cannot: a re-export naming another
  // module. Without it the mark stopped at the module boundary, and a barrel
  // saying `export type { Sale } from "./sale.js"` published every class member
  // the declaring file holds, which is the opposite of both what the author
  // wrote and what the same intent written locally does.
  TypeOnly bool
}

// collectModuleExports reads a file's public surface as importers see it.
//
// The materializer deliberately skips re-exports when building units, because a
// re-export declares nothing and must not create a second unit. That rule is
// untouched here: this table records reachability, and identity is resolved
// separately by following the specifier to the file that declares the symbol.
func collectModuleExports(file *shimast.SourceFile) []moduleExport {
  exports := []moduleExport{}
  if file == nil || file.Statements == nil {
    return exports
  }
  locals := collectLocalExportNames(file.Statements)
  for _, statement := range file.Statements.Nodes {
    if statement == nil {
      continue
    }
    if statement.Kind == shimast.KindExportDeclaration {
      exports = append(exports, exportDeclarationEntries(statement, locals)...)
      continue
    }
    if !isSyntacticallyExported(statement) {
      continue
    }
    for _, declared := range topLevelDeclaredNames(statement) {
      exports = append(exports, moduleExport{
        Public: declared.Name,
        Local:  declared.Name,
      })
      for _, exported := range locals[declared.Name] {
        if exported.Public != declared.Name {
          exports = append(exports, moduleExport{
            Public: exported.Public,
            Local:  declared.Name,
          })
        }
      }
    }
  }
  for local, names := range locals {
    for _, exported := range names {
      if exported.Public == "" {
        continue
      }
      exports = append(exports, moduleExport{
        Public: exported.Public,
        Local:  local,
      })
    }
  }
  return dedupeModuleExports(exports)
}

func exportDeclarationEntries(
  statement *shimast.Node,
  locals map[string][]exportedName,
) []moduleExport {
  declaration := statement.AsExportDeclaration()
  if declaration == nil {
    return nil
  }
  specifier := stringLiteralText(declaration.ModuleSpecifier)
  if specifier == "" {
    // A local export list is already covered by the locals table, which the
    // caller folds in; recording it twice would double every aliased name.
    return nil
  }
  if declaration.ExportClause == nil {
    // `export * from` and `export type * from`. The star form has no clause to
    // carry a per-name mark, so the declaration's own is the whole answer.
    return []moduleExport{{
      Specifier: specifier,
      TypeOnly:  declaration.IsTypeOnly,
    }}
  }
  switch declaration.ExportClause.Kind {
  case shimast.KindNamespaceExport:
    name := declarationName(declaration.ExportClause.Name())
    if name == "" {
      return nil
    }
    return []moduleExport{{
      Public:    name,
      Specifier: specifier,
      Namespace: true,
      TypeOnly:  declaration.IsTypeOnly,
    }}
  case shimast.KindNamedExports:
    named := declaration.ExportClause.AsNamedExports()
    if named == nil || named.Elements == nil {
      return nil
    }
    entries := []moduleExport{}
    for _, element := range named.Elements.Nodes {
      if element == nil || element.Kind != shimast.KindExportSpecifier {
        continue
      }
      exportSpecifier := element.AsExportSpecifier()
      if exportSpecifier == nil {
        continue
      }
      public := declarationName(element.Name())
      imported := public
      if exportSpecifier.PropertyName != nil {
        imported = declarationName(exportSpecifier.PropertyName)
      }
      if public == "" || imported == "" {
        continue
      }
      entries = append(entries, moduleExport{
        Public:    public,
        Specifier: specifier,
        Imported:  imported,
        // Either spelling marks it. The declaration carries the mark for
        // `export type { A, B } from`, the specifier for
        // `export { type A, B } from`, and the second is per name.
        TypeOnly: declaration.IsTypeOnly || exportSpecifier.IsTypeOnly,
      })
    }
    return entries
  }
  return nil
}

func dedupeModuleExports(exports []moduleExport) []moduleExport {
  seen := map[moduleExport]bool{}
  unique := make([]moduleExport, 0, len(exports))
  for _, export := range exports {
    if seen[export] {
      continue
    }
    seen[export] = true
    unique = append(unique, export)
  }
  sort.SliceStable(unique, func(left int, right int) bool {
    return unique[left].Public < unique[right].Public
  })
  return unique
}

// reachedSymbol is one public address an entry traversal arrived at.
// traversedPopulation is what selecting modules and walking their exports
// yields: the obligations, the scopes above them, and the addresses that reach
// them.
type traversedPopulation struct {
  Units   []*evidenceUnit
  Reached []*evidenceUnit
  // Hidden are the reached declarations that withdrew themselves from the
  // public surface with an `@internal`, `@hidden`, or `@ignore` documentation
  // tag. They are addressed like any other reached unit and selected as none,
  // so a citation of one is answered with its cause.
  Hidden    []*evidenceUnit
  Published []publishedAddress
}

// publishedAddress is one module publishing one unit under one address.
//
// A symbol is citable from every module that exposes it, under the name that
// module gives it. Recording the pair keeps import-scope resolution honest when
// several selected modules publish the same declaration: each address is legal
// exactly where it is written, and none of them is legal everywhere.
type publishedAddress struct {
  Module  string
  Address string
  Unit    *evidenceUnit
}

type reachedSymbol struct {
  // Address is the accessor path from the entry, segment by segment.
  Address []string
  // Path is the file that declares the symbol, which owns its identity.
  Path string
  // Local is the name that file's inventory gives the declaration, which is
  // the name it exposes rather than the binding it wrote. `export { a as b }`
  // declares one unit called `b`, so matching on `a` would find nothing.
  Local string
  // TypeOnly is true when some edge on the path from the entry to this symbol
  // carried only its type side. It travels rather than being read at the end,
  // because a barrel re-exported type-only withholds value-space from
  // everything below it however many hops away that is.
  TypeOnly bool
}

// traverseEntryExports walks a module's export graph and reports every public
// symbol it reaches, with the address the entry gives it.
//
// Membership comes from reachability and identity comes from the declaring
// file, so a symbol re-exported through two barrels is reached twice and still
// resolves to one unit. Cycles are bounded by the visited set: a barrel that
// re-exports itself is a real shape, not a reason to hang the build.
func traverseEntryExports(
  loader *typeScriptLoader,
  entry string,
  prefix []string,
  visited map[string]bool,
  typeOnly bool,
) []reachedSymbol {
  if visited[entry] {
    return nil
  }
  visited[entry] = true
  defer delete(visited, entry)

  inventory := loader.inventory(entry)
  if inventory == nil {
    return nil
  }
  reached := []reachedSymbol{}
  // Named re-exports are grouped by the module they come from and that module
  // is walked once. Walking it per specifier would re-traverse the whole
  // subtree for every name a barrel forwards, which is quadratic on exactly
  // the wide generated barrels this selection exists to describe.
  surfaces := map[string]map[string]reachedSymbol{}
  surfaceOf := func(target string) map[string]reachedSymbol {
    if surface, built := surfaces[target]; built {
      return surface
    }
    surface := map[string]reachedSymbol{}
    for _, nested := range traverseEntryExports(loader, target, nil, visited, false) {
      if len(nested.Address) != 1 {
        continue
      }
      if _, taken := surface[nested.Address[0]]; !taken {
        surface[nested.Address[0]] = nested
      }
    }
    surfaces[target] = surface
    return surface
  }
  for _, export := range inventory.Exports {
    if export.Specifier == "" {
      // A declaration this module exposes is inventoried under the name it
      // exposes it as. `export { local as renamed }` is one unit named
      // `renamed`, so the local binding never identifies it.
      reached = append(reached, reachedSymbol{
        Address:  append(append([]string{}, prefix...), export.Public),
        Path:     entry,
        Local:    export.Public,
        TypeOnly: typeOnly,
      })
      continue
    }
    target := loader.resolve(entry, export.Specifier)
    if target == "" {
      continue
    }
    switch {
    case export.Namespace:
      reached = append(reached, traverseEntryExports(
        loader,
        target,
        append(append([]string{}, prefix...), export.Public),
        visited,
        typeOnly || export.TypeOnly,
      )...)
    case export.Imported == "":
      reached = append(reached, traverseEntryExports(
        loader,
        target,
        prefix,
        visited,
        typeOnly || export.TypeOnly,
      )...)
    default:
      nested, found := surfaceOf(target)[export.Imported]
      if !found {
        continue
      }
      reached = append(reached, reachedSymbol{
        Address: append(append([]string{}, prefix...), export.Public),
        Path:    nested.Path,
        Local:   nested.Local,
        // The edge into this module and every edge the target itself walked
        // both count, so a type-only hop anywhere on the path withholds.
        TypeOnly: typeOnly || export.TypeOnly || nested.TypeOnly,
      })
    }
  }
  return reached
}

// materializeEntryUnits turns reached symbols into the units an obligation
// counts, giving each its entry-relative address.
//
// A declaration's descendants travel with it: reaching `ISale` also reaches
// `ISale.price`, because the property is addressable exactly when its owner is.
// Addresses are rebuilt from identity segments rather than by rewriting the
// joined target, so a literal dot inside a name cannot collapse into
// qualification.
//
// Several entries union into one population. A glob selects modules, not
// symbols, so a barrel it matched carries in everything that barrel re-exports;
// a declaration two entries both reach stays one unit answering to both
// addresses.
//
// Units are the selected obligation set, Reached is everything the traversal
// saw — which keeps an unselected ancestor addressable as the aggregate scope
// of the units below it — and Published records where each address is legal.
func materializeEntryUnits(
  loader *typeScriptLoader,
  entries []string,
  symbols symbolSet,
) traversedPopulation {
  byID := map[string]*evidenceUnit{}
  order := []string{}
  published := []publishedAddress{}
  candidates := newOwnedUnitIndex(loader)
  for _, entry := range entries {
    for _, symbol := range traverseEntryExports(loader, entry, nil, map[string]bool{}, false) {
      if symbol.Local == "" {
        continue
      }
      for _, unit := range candidates.of(symbol.Path, symbol.Local) {
        suffix, owned := identitySuffix(unit.Identity, symbol.Local)
        if !owned {
          continue
        }
        // A type-only edge exposes no value, so nothing reached only through
        // one comes with it. The name itself still arrives, because a type is
        // exactly what such an export carries.
        if symbol.TypeOnly && unit.ValueSpace {
          continue
        }
        address := append(append([]string{}, symbol.Address...), suffix...)
        target := strings.Join(address, ".")
        current := byID[unit.ID]
        if current == nil {
          clone := *unit
          clone.Target = target
          clone.Identity = address
          clone.Aliases = nil
          current = &clone
          byID[unit.ID] = current
          order = append(order, unit.ID)
        } else if current.Target != target &&
          !containsString(current.Aliases, target) {
          // Two addresses for one declaration. The shorter one reads as
          // the canonical path, and the rest resolve to the same unit so
          // the obligation is still counted once.
          if len(address) < len(current.Identity) {
            current.Aliases = append(current.Aliases, current.Target)
            current.Target = target
            current.Identity = address
          } else {
            current.Aliases = append(current.Aliases, target)
          }
        }
        published = append(published, publishedAddress{
          Module:  entry,
          Address: target,
          Unit:    current,
        })
      }
    }
  }
  population := traversedPopulation{Published: published}
  for _, id := range order {
    unit := byID[id]
    sort.Strings(unit.Aliases)
    // A declaration withdrawn from the surface by its own documentation tag
    // is neither an obligation nor an aggregate scope. It is kept apart
    // rather than dropped so a citation naming it can be told why, which a
    // bare unresolved target could not say.
    if unit.Hidden != "" {
      population.Hidden = append(population.Hidden, unit)
      continue
    }
    // Every reached declaration stays available as an aggregate scope, even
    // when its own kind is unselected. The selector is the obligation
    // denominator, not the list of targets an author may write.
    population.Reached = append(population.Reached, unit)
    if symbols.contains(unit.Symbol) {
      population.Units = append(population.Units, unit)
    }
  }
  return population
}

// narrowTraversedPopulation keeps the entry's addresses and the narrowing's
// membership.
//
// Both arguments describe the same declarations; they differ only in which
// module each was reached from, and therefore in the address each unit answers
// to. Identity is what joins them, because a re-export decides reachability and
// never identity — the same declaration carries the same unit ID however it was
// reached.
//
// Reached and Published stay whole. Reached is read only to walk the parent
// chain above a selected unit, and an ancestor is addressable because it is an
// ancestor rather than because it was selected, so narrowing it would be work
// with nothing to change. Published is what a citation resolves against, and it
// is the entry's addresses that a consumer can write.
func narrowTraversedPopulation(
  published traversedPopulation,
  membership traversedPopulation,
) traversedPopulation {
  selected := make(map[string]bool, len(membership.Units))
  for _, unit := range membership.Units {
    selected[unit.ID] = true
  }
  withdrawn := make(map[string]bool, len(membership.Hidden))
  for _, unit := range membership.Hidden {
    withdrawn[unit.ID] = true
  }
  narrowed := traversedPopulation{
    Reached:   published.Reached,
    Published: published.Published,
  }
  for _, unit := range published.Units {
    if selected[unit.ID] {
      narrowed.Units = append(narrowed.Units, unit)
    }
  }
  for _, unit := range published.Hidden {
    if withdrawn[unit.ID] {
      narrowed.Hidden = append(narrowed.Hidden, unit)
    }
  }
  return narrowed
}

// ownedUnitIndex narrows a file's units to the ones a reached name can own.
//
// Membership is decided by identity prefix, so only units whose first segment
// equals the reached name are candidates. Scanning the whole file instead costs
// one pass per reached name, which is quadratic in a module's own width — and a
// generated declaration barrel is exactly where that width is largest.
type ownedUnitIndex struct {
  loader *typeScriptLoader
  byPath map[string]map[string][]*evidenceUnit
}

func newOwnedUnitIndex(loader *typeScriptLoader) *ownedUnitIndex {
  return &ownedUnitIndex{
    loader: loader,
    byPath: map[string]map[string][]*evidenceUnit{},
  }
}

// of lists the units of one file that may be owned by one reached name.
func (index *ownedUnitIndex) of(path string, local string) []*evidenceUnit {
  roots, built := index.byPath[path]
  if !built {
    roots = map[string][]*evidenceUnit{}
    if inventory := index.loader.inventory(path); inventory != nil {
      for _, unit := range inventory.Units {
        if len(unit.Identity) == 0 {
          continue
        }
        roots[unit.Identity[0]] = append(roots[unit.Identity[0]], unit)
      }
    }
    index.byPath[path] = roots
  }
  root := local
  if cut := strings.Index(local, "."); cut != -1 {
    root = local[:cut]
  }
  return roots[root]
}

// identitySuffix reports the segments below a reached declaration, and whether
// the unit belongs to it at all.
func identitySuffix(identity []string, local string) ([]string, bool) {
  owner := strings.Split(local, ".")
  if len(identity) < len(owner) {
    return nil, false
  }
  for index, segment := range owner {
    if identity[index] != segment {
      return nil, false
    }
  }
  return identity[len(owner):], true
}

func containsString(values []string, wanted string) bool {
  for _, value := range values {
    if value == wanted {
      return true
    }
  }
  return false
}
