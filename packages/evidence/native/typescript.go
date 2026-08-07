package evidence

import (
  "path/filepath"
  "sort"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

func loadTypeScriptInventories(
  root string,
  sources []*shimast.SourceFile,
  config graphConfig,
) map[string]*artifactInventory {
  inventories := map[string]*artifactInventory{}
  extendTypeScriptInventories(root, sources, config, inventories)
  return inventories
}

// extendTypeScriptInventories adds only populations the caller has not already
// scanned.
//
// Graph activation first needs each TypeScript claim's own population, before
// it is allowed to inspect that claim's references. Once active claims are
// known, this second pass adds their reference bases without rescanning the
// claim bases already materialized.
func extendTypeScriptInventories(
  root string,
  sources []*shimast.SourceFile,
  config graphConfig,
  inventories map[string]*artifactInventory,
) {
  bases := configuredBases(config, artifactTypeScript)
  for _, file := range sources {
    if file == nil || !isTypeScriptPath(file.FileName()) {
      continue
    }
    for _, base := range bases {
      relative, ok := relativeProjectPath(base.Absolute, file.FileName())
      if !ok || !isTypeScriptPath(relative) {
        continue
      }
      address := base.addressOf(relative)
      if inventories[address.Key] != nil {
        continue
      }
      inventories[address.Key] = typeScriptInventories.scan(address, file)
    }
  }
}

// isTypeScriptPath is asked once per source file per configured base on every
// rebuild, so it compares the suffix in place rather than lowercasing the whole
// path into a fresh string to answer four fixed questions.
func isTypeScriptPath(path string) bool {
  for _, suffix := range []string{".ts", ".tsx", ".mts", ".cts"} {
    if len(path) >= len(suffix) &&
      strings.EqualFold(path[len(path)-len(suffix):], suffix) {
      return true
    }
  }
  return false
}

func relativeProjectPath(root string, absolute string) (string, bool) {
  if root == "" || absolute == "" {
    return "", false
  }
  // A source file usually sits below the base that is asking, spelled the same
  // way. Answering that from the two strings keeps the general path machinery
  // off a loop that runs once per file per base on every rebuild.
  if inside, ok := containedProjectPath(root, absolute); ok {
    return inside, true
  }
  relative, err := filepath.Rel(root, absolute)
  if err != nil {
    return "", false
  }
  relative = strings.ReplaceAll(relative, "\\", "/")
  if relative == ".." || strings.HasPrefix(relative, "../") {
    return "", false
  }
  return strings.TrimPrefix(relative, "./"), true
}

// containedProjectPath answers the ordinary case of one path sitting below
// another: same spelling, one separator between them, and nothing left to
// normalize. It declines anything else so the general form still decides.
//
// The prefix comparison is exact rather than case-insensitive, because the
// general form is `filepath.Rel`, which is lexical and case-sensitive on every
// platform. Folding case here would admit a differently-cased sibling that the
// path this shortcut stands in for rejects.
func containedProjectPath(root string, absolute string) (string, bool) {
  if len(absolute) <= len(root)+1 ||
    absolute[:len(root)] != root {
    return "", false
  }
  if separator := absolute[len(root)]; separator != '/' && separator != '\\' {
    return "", false
  }
  relative := absolute[len(root)+1:]
  if strings.ContainsRune(relative, '\\') {
    return "", false
  }
  for segment := range strings.SplitSeq(relative, "/") {
    if segment == "" || segment == "." || segment == ".." {
      return "", false
    }
  }
  return relative, true
}

func scanTypeScriptInventory(
  path string,
  file *shimast.SourceFile,
) *artifactInventory {
  return scanTypeScriptInventoryAt(artifactAddress{
    Base:     populationBase{Default: true},
    Relative: path,
    Display:  path,
    Key:      path,
  }, file)
}

func scanTypeScriptInventoryAt(
  address artifactAddress,
  file *shimast.SourceFile,
) *artifactInventory {
  inventory := &artifactInventory{
    Address:   address.Key,
    Path:      address.Display,
    Type:      artifactTypeScript,
    Imports:   collectImportBindings(file),
    Exports:   collectModuleExports(file),
    UnitNodes: map[string][]*shimast.Node{},
  }
  supportedHosts := map[*shimast.Node]symbolSet{}
  unitsByID := map[string]*evidenceUnit{}
  collectTypeScriptStatements(
    file,
    file.Statements,
    nil,
    "",
    inventory,
    supportedHosts,
    unitsByID,
    file.IsDeclarationFile,
    false,
    false,
    "",
  )
  collectTypeScriptDeclarations(
    file,
    address.Key,
    address.Display,
    inventory,
    supportedHosts,
  )
  // Policy evaluation needs semantic host IDs, not the AST node associations
  // used to derive them. Declarations now retain those IDs directly, so release
  // the transient index before this inventory enters the immutable graph.
  inventory.UnitNodes = nil
  sort.Slice(inventory.Units, func(left int, right int) bool {
    if inventory.Units[left].Target != inventory.Units[right].Target {
      return inventory.Units[left].Target < inventory.Units[right].Target
    }
    return inventory.Units[left].Line < inventory.Units[right].Line
  })
  return inventory
}

// collectTypeScriptStatements materializes the public units one statement list
// declares.
//
// hidden carries the documentation tag by which an enclosing declaration
// withdrew itself from the public surface. It is inherited rather than
// recomputed, which is what makes `@internal` on a namespace reach every member
// beneath it without each member repeating the tag.
func collectTypeScriptStatements(
  file *shimast.SourceFile,
  statements *shimast.NodeList,
  prefix []string,
  parentID string,
  inventory *artifactInventory,
  supportedHosts map[*shimast.Node]symbolSet,
  unitsByID map[string]*evidenceUnit,
  ambientContext bool,
  implicitlyExported bool,
  typeOnlyProjection bool,
  hidden string,
) {
  if statements == nil {
    return
  }
  exports := collectLocalExportNames(statements)
  hiddenNames := collectHiddenDeclarationNames(file, statements)
  // Built on the first namespace this list holds rather than up front, so a
  // file declaring none pays nothing. Every rebuild scans every configured
  // source, and most of them have no namespace at all.
  var functionNames map[string]bool
  for _, statement := range statements.Nodes {
    if statement == nil {
      continue
    }
    switch statement.Kind {
    case shimast.KindInterfaceDeclaration:
      name := declarationName(statement.Name())
      if name == "" {
        continue
      }
      targets := publicTypeScriptNames(
        statement,
        name,
        exports,
        true,
        implicitlyExported,
      )
      if len(targets) == 0 {
        continue
      }
      memberHidden := hidingTagFor(hidden, hiddenNames, name)
      if memberHidden == "" {
        addTypeScriptHost(supportedHosts, statement, "type")
      }
      for _, name := range targets {
        identity := qualifyTypeScriptName(prefix, name)
        unit := addTypeScriptUnit(
          inventory,
          unitsByID,
          statement,
          "type",
          identity,
          parentID,
          memberHidden,
        )
        collectPropertyMembers(
          file,
          statement.AsInterfaceDeclaration().Members,
          identity,
          unit.ID,
          inventory,
          supportedHosts,
          unitsByID,
          memberHidden,
        )
      }
    case shimast.KindTypeAliasDeclaration:
      name := declarationName(statement.Name())
      if name == "" {
        continue
      }
      targets := publicTypeScriptNames(
        statement,
        name,
        exports,
        true,
        implicitlyExported,
      )
      if len(targets) == 0 {
        continue
      }
      memberHidden := hidingTagFor(hidden, hiddenNames, name)
      if memberHidden == "" {
        addTypeScriptHost(supportedHosts, statement, "type")
      }
      alias := statement.AsTypeAliasDeclaration()
      for _, name := range targets {
        identity := qualifyTypeScriptName(prefix, name)
        unit := addTypeScriptUnit(
          inventory,
          unitsByID,
          statement,
          "type",
          identity,
          parentID,
          memberHidden,
        )
        if alias.Type != nil && alias.Type.Kind == shimast.KindTypeLiteral {
          collectPropertyMembers(
            file,
            alias.Type.AsTypeLiteralNode().Members,
            identity,
            unit.ID,
            inventory,
            supportedHosts,
            unitsByID,
            memberHidden,
          )
        }
      }
    case shimast.KindFunctionDeclaration:
      if typeOnlyProjection {
        continue
      }
      name := declarationName(statement.Name())
      if name == "" {
        continue
      }
      targets := publicTypeScriptNames(
        statement,
        name,
        exports,
        false,
        implicitlyExported,
      )
      if len(targets) == 0 {
        continue
      }
      memberHidden := hidingTagFor(hidden, hiddenNames, name)
      if memberHidden == "" {
        addTypeScriptHost(supportedHosts, statement, "function")
      }
      for _, name := range targets {
        addTypeScriptUnit(
          inventory,
          unitsByID,
          statement,
          "function",
          qualifyTypeScriptName(prefix, name),
          parentID,
          memberHidden,
        )
      }
    case shimast.KindVariableStatement:
      if typeOnlyProjection {
        continue
      }
      memberHidden := typeScriptHidingTag(file, statement, hidden)
      for symbol := range collectTypeScriptVariables(
        statement,
        prefix,
        parentID,
        exports,
        inventory,
        supportedHosts,
        unitsByID,
        implicitlyExported,
        memberHidden,
      ) {
        if memberHidden != "" {
          continue
        }
        // TypeScript attaches the leading JSDoc of
        // a variable declaration to the statement wrapper.
        addTypeScriptHost(supportedHosts, statement, symbol)
      }
    case shimast.KindClassDeclaration:
      if typeOnlyProjection {
        continue
      }
      name := declarationName(statement.Name())
      memberHidden := hidingTagFor(hidden, hiddenNames, name)
      for _, publicName := range publicTypeScriptNames(
        statement,
        name,
        exports,
        false,
        implicitlyExported,
      ) {
        collectClassCallables(
          file,
          statement,
          qualifyTypeScriptName(prefix, publicName),
          parentID,
          inventory,
          supportedHosts,
          unitsByID,
          memberHidden,
        )
      }
    case shimast.KindModuleDeclaration:
      name := declarationName(statement.Name())
      targets := publicTypeScriptExports(
        statement,
        name,
        exports,
        true,
        implicitlyExported,
      )
      if len(targets) == 0 {
        continue
      }
      memberHidden := hidingTagFor(hidden, hiddenNames, name)
      if memberHidden == "" {
        addTypeScriptHost(supportedHosts, statement, "type")
      }
      // A namespace merged with a same-named function is that function's
      // static side, not an independent container. `get.path` is a
      // property of the `get` function value and `get.Output` is the type
      // its own signature spells; neither is authored contract, so the
      // merged namespace contributes its identity and nothing beneath it.
      // Selecting those members is also what promoted the namespace to an
      // addressable aggregate scope, where it collided with the function
      // unit of the same name and left the accessor with no spelling that
      // resolves.
      if functionNames == nil {
        functionNames = collectFunctionDeclarationNames(statements)
      }
      staticSide := functionNames[name]
      for _, target := range targets {
        identity := qualifyTypeScriptName(prefix, target.Public)
        unit := addTypeScriptUnit(
          inventory,
          unitsByID,
          statement,
          "type",
          identity,
          parentID,
          memberHidden,
        )
        if !staticSide {
          collectTypeScriptModule(
            file,
            statement,
            identity,
            unit.ID,
            inventory,
            supportedHosts,
            unitsByID,
            ambientContext,
            typeOnlyProjection || target.TypeOnly,
            memberHidden,
          )
        }
      }
    }
  }
}

// collectFunctionDeclarationNames indexes the local names a statement list
// declares as functions, which is what a namespace in the same list merges with.
//
// A namespace merges only with a function, a class, or an enum in the same
// scope; a `const` or `let` of the same name is `TS2451`, measured against the
// pinned compiler. Of the three legal partners only a function also
// materializes a unit under the merged name — a class registers no unit of its
// own and the collector has no enum case — so the function form is the one
// shape where a namespace and the declaration it merges with are the same
// public entity spelled twice.
//
// The name alone decides, without consulting export modifiers, because
// TypeScript refuses a merged declaration whose halves disagree on export
// (`TS2395`, measured). The whole list is indexed rather than only the
// statements already collected, because merging does not depend on which
// declaration is written first.
func collectFunctionDeclarationNames(
  statements *shimast.NodeList,
) map[string]bool {
  names := map[string]bool{}
  if statements == nil {
    return names
  }
  for _, statement := range statements.Nodes {
    if statement == nil ||
      statement.Kind != shimast.KindFunctionDeclaration {
      continue
    }
    if name := declarationName(statement.Name()); name != "" {
      names[name] = true
    }
  }
  return names
}

func collectTypeScriptVariables(
  statement *shimast.Node,
  prefix []string,
  parentID string,
  exports map[string][]exportedName,
  inventory *artifactInventory,
  supportedHosts map[*shimast.Node]symbolSet,
  unitsByID map[string]*evidenceUnit,
  implicitlyExported bool,
  hidden string,
) symbolSet {
  variable := statement.AsVariableStatement()
  if variable.DeclarationList == nil {
    return nil
  }
  list := variable.DeclarationList.AsVariableDeclarationList()
  if list.Declarations == nil {
    return nil
  }
  found := symbolSet{}
  for _, declaration := range list.Declarations.Nodes {
    if declaration == nil {
      continue
    }
    value := declaration.AsVariableDeclaration()
    symbol := "property"
    if !shimast.IsBindingPattern(declaration.Name()) &&
      shimast.IsConst(declaration) &&
      isFunctionValue(value.Initializer) {
      symbol = "function"
    }
    for _, binding := range bindingIdentifierNodes(declaration.Name()) {
      name := declarationName(binding)
      targets := publicTypeScriptNames(
        statement,
        name,
        exports,
        false,
        implicitlyExported,
      )
      if len(targets) == 0 {
        continue
      }
      if hidden == "" {
        addTypeScriptHost(supportedHosts, declaration, symbol)
      }
      for _, name := range targets {
        unit := addTypeScriptUnit(
          inventory,
          unitsByID,
          binding,
          symbol,
          qualifyTypeScriptName(prefix, name),
          parentID,
          hidden,
        )
        // The binding names the unit, but TypeScript attaches a
        // variable's leading JSDoc to the statement wrapper, so that
        // is where a citation for this unit actually lives.
        inventory.recordUnitNode(unit.ID, statement)
      }
      found[symbol] = true
    }
  }
  return found
}

func collectClassCallables(
  file *shimast.SourceFile,
  statement *shimast.Node,
  classIdentity []string,
  parentID string,
  inventory *artifactInventory,
  supportedHosts map[*shimast.Node]symbolSet,
  unitsByID map[string]*evidenceUnit,
  hidden string,
) {
  class := statement.AsClassDeclaration()
  if class.Members == nil {
    return
  }
  for _, member := range class.Members.Nodes {
    if member == nil || !isPublicClassMember(member) {
      continue
    }
    callable := false
    switch member.Kind {
    case shimast.KindMethodDeclaration:
      callable = true
    case shimast.KindPropertyDeclaration:
      if member.ModifierFlags()&shimast.ModifierFlagsAccessor != 0 {
        continue
      }
      property := member.AsPropertyDeclaration()
      callable = isFunctionValue(property.Initializer) ||
        isDirectFunctionType(property.Type)
    }
    if !callable {
      continue
    }
    memberName := declarationName(member.Name())
    if memberName == "" {
      continue
    }
    identity := qualifyTypeScriptName(classIdentity, "prototype", memberName)
    if shimast.GetCombinedModifierFlags(member)&shimast.ModifierFlagsStatic != 0 {
      identity = qualifyTypeScriptName(classIdentity, memberName)
    }
    memberHidden := typeScriptHidingTag(file, member, hidden)
    addTypeScriptUnit(
      inventory,
      unitsByID,
      member,
      "function",
      identity,
      parentID,
      memberHidden,
    )
    if memberHidden == "" {
      addTypeScriptHost(supportedHosts, member, "function")
    }
  }
}

func isPublicClassMember(node *shimast.Node) bool {
  flags := shimast.GetCombinedModifierFlags(node)
  return flags&shimast.ModifierFlagsPrivate == 0 &&
    flags&shimast.ModifierFlagsProtected == 0
}

func isFunctionValue(node *shimast.Node) bool {
  for node != nil {
    switch node.Kind {
    case shimast.KindArrowFunction, shimast.KindFunctionExpression:
      return true
    case shimast.KindParenthesizedExpression,
      shimast.KindAsExpression,
      shimast.KindSatisfiesExpression,
      shimast.KindNonNullExpression,
      shimast.KindTypeAssertionExpression:
      node = node.Expression()
    default:
      return false
    }
  }
  return false
}

func isDirectFunctionType(node *shimast.Node) bool {
  for node != nil && node.Kind == shimast.KindParenthesizedType {
    parenthesized := node.AsParenthesizedTypeNode()
    if parenthesized == nil {
      return false
    }
    node = parenthesized.Type
  }
  return node != nil && node.Kind == shimast.KindFunctionType
}

func collectTypeScriptModule(
  file *shimast.SourceFile,
  node *shimast.Node,
  qualified []string,
  parentID string,
  inventory *artifactInventory,
  supportedHosts map[*shimast.Node]symbolSet,
  unitsByID map[string]*evidenceUnit,
  ambientContext bool,
  typeOnlyProjection bool,
  hidden string,
) {
  if node == nil || node.Kind != shimast.KindModuleDeclaration {
    return
  }
  module := node.AsModuleDeclaration()
  if module.Body == nil {
    return
  }
  switch module.Body.Kind {
  case shimast.KindModuleBlock:
    moduleAmbient := ambientContext ||
      shimast.GetCombinedModifierFlags(node)&shimast.ModifierFlagsAmbient != 0
    collectTypeScriptStatements(
      file,
      module.Body.AsModuleBlock().Statements,
      qualified,
      parentID,
      inventory,
      supportedHosts,
      unitsByID,
      moduleAmbient,
      moduleAmbient,
      typeOnlyProjection,
      hidden,
    )
  case shimast.KindModuleDeclaration:
    // `export namespace Outer.Inner {}` is represented as nested module
    // declarations; the inner declaration inherits the outer export.
    name := declarationName(module.Body.Name())
    if name != "" {
      identity := qualifyTypeScriptName(qualified, name)
      innerHidden := typeScriptHidingTag(file, module.Body, hidden)
      if innerHidden == "" {
        addTypeScriptHost(supportedHosts, module.Body, "type")
      }
      unit := addTypeScriptUnit(
        inventory,
        unitsByID,
        module.Body,
        "type",
        identity,
        parentID,
        innerHidden,
      )
      collectTypeScriptModule(
        file,
        module.Body,
        identity,
        unit.ID,
        inventory,
        supportedHosts,
        unitsByID,
        ambientContext ||
          shimast.GetCombinedModifierFlags(node)&shimast.ModifierFlagsAmbient != 0,
        typeOnlyProjection,
        innerHidden,
      )
    }
  }
}

func collectPropertyMembers(
  file *shimast.SourceFile,
  members *shimast.NodeList,
  owner []string,
  parentID string,
  inventory *artifactInventory,
  supportedHosts map[*shimast.Node]symbolSet,
  unitsByID map[string]*evidenceUnit,
  hidden string,
) {
  if members == nil {
    return
  }
  for _, member := range members.Nodes {
    if member == nil || member.Kind != shimast.KindPropertySignature {
      continue
    }
    name := declarationName(member.Name())
    if name == "" {
      continue
    }
    identity := qualifyTypeScriptName(owner, name)
    memberHidden := typeScriptHidingTag(file, member, hidden)
    addTypeScriptUnit(
      inventory,
      unitsByID,
      member,
      "property",
      identity,
      parentID,
      memberHidden,
    )
    if memberHidden == "" {
      addTypeScriptHost(supportedHosts, member, "property")
    }
  }
}

// collectHiddenDeclarationNames indexes the local names a statement list
// withdraws from the public surface, by the tag that withdrew each.
//
// The index is over names rather than over nodes because declaration merging
// makes one name several declarations. `interface I` beside `namespace I` is
// one public identity and one unit, so a tag on either half withdraws the
// identity — and which half carries it is a matter of where the author wrote
// the comment. Reading only the node in hand would leave the identity
// withdrawn while its members stayed selected, depending on source order.
func collectHiddenDeclarationNames(
  file *shimast.SourceFile,
  statements *shimast.NodeList,
) map[string]string {
  if file == nil || statements == nil {
    return nil
  }
  var names map[string]string
  for _, statement := range statements.Nodes {
    if statement == nil {
      continue
    }
    name := declarationName(statement.Name())
    if name == "" {
      continue
    }
    tag := typeScriptHidingTag(file, statement, "")
    if tag == "" {
      continue
    }
    if names == nil {
      names = map[string]string{}
    }
    if names[name] == "" {
      names[name] = tag
    }
  }
  return names
}

// hidingTagFor answers for one local name, preferring an inherited tag.
func hidingTagFor(
  inherited string,
  names map[string]string,
  local string,
) string {
  if inherited != "" {
    return inherited
  }
  return names[local]
}

// typeScriptHidingTag reports the documentation tag that withdraws a
// declaration from the public surface, inheriting an enclosing one.
//
// An inherited tag wins outright and the node's own blocks are not consulted:
// once an ancestor is out of the surface, nothing beneath it can opt back in,
// and the cause an author has to be told about is the outermost tag.
func typeScriptHidingTag(
  file *shimast.SourceFile,
  node *shimast.Node,
  inherited string,
) string {
  if inherited != "" {
    return inherited
  }
  if file == nil || node == nil {
    return ""
  }
  content := file.Text()
  for _, doc := range node.JSDoc(file) {
    if doc == nil ||
      doc.Pos() < 0 ||
      doc.End() > len(content) ||
      doc.Pos() >= doc.End() {
      continue
    }
    if tag := commentHidingTag(content[doc.Pos():doc.End()]); tag != "" {
      return tag
    }
  }
  return ""
}

func addTypeScriptUnit(
  inventory *artifactInventory,
  unitsByID map[string]*evidenceUnit,
  node *shimast.Node,
  symbol string,
  identity []string,
  parentID string,
  hidden string,
) *evidenceUnit {
  target := strings.Join(identity, ".")
  address := inventory.Address
  if address == "" {
    address = inventory.Path
  }
  id := "typescript:" + address + ":" + symbol + ":" + encodeTypeScriptIdentity(identity)
  // Recorded before the dedupe below, so a merged identity keeps every
  // declaration that spells it. `interface I` beside `namespace I` is one
  // unit and two nodes, and a rule asking where that unit's JSDoc may live
  // has to see both.
  inventory.recordUnitNode(id, node)
  if unit := unitsByID[id]; unit != nil {
    // A merged identity is one unit, so one declaration marking itself
    // internal marks the identity. Both halves of `interface I` beside
    // `namespace I` name the same public thing, and honoring only the tagged
    // half would leave the identity half in and half out of the surface.
    if hidden != "" && unit.Hidden == "" {
      unit.Hidden = hidden
    }
    return unit
  }
  unit := &evidenceUnit{
    ID:       id,
    ParentID: parentID,
    Target:   target,
    Identity: append([]string{}, identity...),
    Type:     artifactTypeScript,
    Symbol:   symbol,
    Path:     inventory.Path,
    Line:     lineAtNode(inventory.Path, node),
    Readable: "TypeScript " + symbol + " '" + target + "'",
    Hidden:   hidden,
  }
  unitsByID[id] = unit
  inventory.Units = append(inventory.Units, unit)
  return unit
}

func addTypeScriptHost(
  hosts map[*shimast.Node]symbolSet,
  node *shimast.Node,
  symbol string,
) {
  if node == nil {
    return
  }
  if hosts[node] == nil {
    hosts[node] = symbolSet{}
  }
  hosts[node][symbol] = true
}

// lineAtNode stores a byte offset until declarations are scanned against the
// complete source text. A position inside the name is on the declaration
// itself, while both the parent and name full starts may include leading trivia.
func lineAtNode(_ string, node *shimast.Node) int {
  if node == nil {
    return 0
  }
  if name := node.Name(); name != nil && name.End() > 0 {
    return name.End() - 1
  }
  return node.Pos()
}

func collectTypeScriptDeclarations(
  file *shimast.SourceFile,
  address string,
  location string,
  inventory *artifactInventory,
  supportedHosts map[*shimast.Node]symbolSet,
) {
  type docHost struct {
    node            *shimast.Node
    hosts           symbolSet
    hostIDs         map[string]bool
    semanticHostIDs map[string]bool
  }
  semanticHostsByNode := map[*shimast.Node]map[string]bool{}
  for unitID, nodes := range inventory.UnitNodes {
    for _, node := range nodes {
      if node == nil {
        continue
      }
      if semanticHostsByNode[node] == nil {
        semanticHostsByNode[node] = map[string]bool{}
      }
      semanticHostsByNode[node][unitID] = true
    }
  }
  docs := map[string]docHost{}
  walkTypeScriptNode(file.AsNode(), func(node *shimast.Node) {
    for _, doc := range node.JSDoc(file) {
      if doc == nil {
        continue
      }
      key := decimal(doc.Pos()) + ":" + decimal(doc.End())
      candidate := docHost{
        node:            doc,
        hosts:           supportedHosts[node],
        semanticHostIDs: semanticHostsByNode[node],
      }
      if len(candidate.hosts) != 0 {
        candidate.hostIDs = map[string]bool{
          address + ":" + decimal(node.Pos()) + ":" + decimal(node.End()): true,
        }
      }
      current, exists := docs[key]
      if !exists {
        docs[key] = candidate
        continue
      }
      for symbol := range candidate.hosts {
        if current.hosts == nil {
          current.hosts = symbolSet{}
        }
        current.hosts[symbol] = true
      }
      for hostID := range candidate.hostIDs {
        if current.hostIDs == nil {
          current.hostIDs = map[string]bool{}
        }
        current.hostIDs[hostID] = true
      }
      for semanticHostID := range candidate.semanticHostIDs {
        if current.semanticHostIDs == nil {
          current.semanticHostIDs = map[string]bool{}
        }
        current.semanticHostIDs[semanticHostID] = true
      }
      docs[key] = current
    }
  })
  keys := make([]string, 0, len(docs))
  for key := range docs {
    keys = append(keys, key)
  }
  sort.Slice(keys, func(left int, right int) bool {
    leftNode := docs[keys[left]].node
    rightNode := docs[keys[right]].node
    if leftNode.Pos() != rightNode.Pos() {
      return leftNode.Pos() < rightNode.Pos()
    }
    return leftNode.End() < rightNode.End()
  })
  content := file.Text()
  sequence := 0
  for _, key := range keys {
    entry := docs[key]
    if entry.node.Pos() < 0 || entry.node.End() > len(content) || entry.node.Pos() >= entry.node.End() {
      continue
    }
    baseLine := lineAt(content, entry.node.Pos())
    hostIDs := make([]string, 0, len(entry.hostIDs))
    for hostID := range entry.hostIDs {
      hostIDs = append(hostIDs, hostID)
    }
    sort.Strings(hostIDs)
    hostID := strings.Join(hostIDs, "|")
    semanticHostIDs := make([]string, 0, len(entry.semanticHostIDs))
    for semanticHostID := range entry.semanticHostIDs {
      semanticHostIDs = append(semanticHostIDs, semanticHostID)
    }
    sort.Strings(semanticHostIDs)
    for _, parsed := range parseDeclarations(content[entry.node.Pos():entry.node.End()]) {
      sequence++
      inventory.Declarations = append(inventory.Declarations, &evidenceDeclaration{
        ID:               "typescript:" + address + ":" + decimal(baseLine+parsed.LineOffset) + ":" + decimal(sequence),
        HostID:           hostID,
        SemanticHostIDs:  semanticHostIDs,
        Type:             artifactTypeScript,
        Tag:              parsed.Tag,
        Target:           parsed.Target,
        Reason:           parsed.Reason,
        Hosts:            entry.hosts,
        ExclusionCarrier: len(entry.hosts) != 0,
        Path:             location,
        Line:             baseLine + parsed.LineOffset,
        Sequence:         sequence,
      })
    }
  }
  for _, unit := range inventory.Units {
    // TypeScript AST positions are byte offsets; translate them only after
    // the complete source text is available.
    unit.Line = lineAt(content, unit.Line)
  }
}

func walkTypeScriptNode(node *shimast.Node, visit func(*shimast.Node)) {
  if node == nil {
    return
  }
  visit(node)
  node.ForEachChild(func(child *shimast.Node) bool {
    walkTypeScriptNode(child, visit)
    return false
  })
}

type exportedName struct {
  Public   string
  TypeOnly bool
}

func collectLocalExportNames(
  statements *shimast.NodeList,
) map[string][]exportedName {
  exports := map[string][]exportedName{}
  if statements == nil {
    return exports
  }
  for _, statement := range statements.Nodes {
    if statement == nil || statement.Kind != shimast.KindExportDeclaration {
      continue
    }
    declaration := statement.AsExportDeclaration()
    if declaration == nil ||
      declaration.ModuleSpecifier != nil ||
      declaration.ExportClause == nil ||
      declaration.ExportClause.Kind != shimast.KindNamedExports {
      continue
    }
    named := declaration.ExportClause.AsNamedExports()
    if named == nil || named.Elements == nil {
      continue
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
      if local == "" || public == "" || public == "default" {
        continue
      }
      exports[local] = append(exports[local], exportedName{
        Public:   public,
        TypeOnly: declaration.IsTypeOnly || specifier.IsTypeOnly,
      })
    }
  }
  return exports
}

func publicTypeScriptNames(
  node *shimast.Node,
  local string,
  exports map[string][]exportedName,
  allowTypeOnly bool,
  implicitlyExported bool,
) []string {
  projected := publicTypeScriptExports(
    node,
    local,
    exports,
    allowTypeOnly,
    implicitlyExported,
  )
  result := make([]string, 0, len(projected))
  for _, exported := range projected {
    result = append(result, exported.Public)
  }
  return result
}

func publicTypeScriptExports(
  node *shimast.Node,
  local string,
  exports map[string][]exportedName,
  allowTypeOnly bool,
  implicitlyExported bool,
) []exportedName {
  if local == "" {
    return nil
  }
  names := map[string]exportedName{}
  if implicitlyExported || isSyntacticallyExported(node) {
    names[local] = exportedName{Public: local}
  }
  for _, exported := range exports[local] {
    if exported.TypeOnly && !allowTypeOnly {
      continue
    }
    current, exists := names[exported.Public]
    if !exists || current.TypeOnly && !exported.TypeOnly {
      names[exported.Public] = exported
    }
  }
  result := make([]string, 0, len(names))
  for name := range names {
    result = append(result, name)
  }
  sort.Strings(result)
  projected := make([]exportedName, 0, len(result))
  for _, name := range result {
    projected = append(projected, names[name])
  }
  return projected
}

func isSyntacticallyExported(node *shimast.Node) bool {
  return node != nil && shimast.GetCombinedModifierFlags(node)&shimast.ModifierFlagsExport != 0
}

func declarationName(node *shimast.Node) string {
  if node == nil {
    return ""
  }
  switch node.Kind {
  case shimast.KindIdentifier,
    shimast.KindStringLiteral,
    shimast.KindNumericLiteral:
    name := node.Text()
    if containsWhitespace(name) {
      return ""
    }
    return name
  default:
    return ""
  }
}

func bindingIdentifierNodes(node *shimast.Node) []*shimast.Node {
  if node == nil {
    return nil
  }
  if declarationName(node) != "" {
    return []*shimast.Node{node}
  }
  if !shimast.IsBindingPattern(node) {
    return nil
  }
  pattern := node.AsBindingPattern()
  if pattern == nil || pattern.Elements == nil {
    return nil
  }
  nodes := []*shimast.Node{}
  for _, element := range pattern.Elements.Nodes {
    if element == nil || element.Kind != shimast.KindBindingElement {
      continue
    }
    nodes = append(nodes, bindingIdentifierNodes(element.Name())...)
  }
  return nodes
}

func qualifyTypeScriptName(prefix []string, names ...string) []string {
  qualified := make([]string, 0, len(prefix)+len(names))
  qualified = append(qualified, prefix...)
  qualified = append(qualified, names...)
  return qualified
}

func encodeTypeScriptIdentity(identity []string) string {
  var builder strings.Builder
  for _, segment := range identity {
    builder.WriteString(decimal(len(segment)))
    builder.WriteByte(':')
    builder.WriteString(segment)
    builder.WriteByte(';')
  }
  return builder.String()
}
