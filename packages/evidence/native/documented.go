package evidence

import (
  "encoding/json"
  "sort"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// documentedRule requires a JSDoc block on every selected export.
//
// Evidence declarations are read from one place only — the JSDoc blocks a node
// reports — so an export without a block is not merely undocumented, it is
// structurally unable to carry a citation. The graph never says so: coverage is
// counted from the evidence side, so an obligation is discharged by whichever
// host does have a block while every undocumented export in the same claim
// contributes nothing and looks exactly like a passing file.
type documentedRule struct{}

type documentedOptions struct {
  Symbol json.RawMessage `json:"symbol"`
}

func (documentedRule) Name() string { return documentedRuleName }

func (documentedRule) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}

func (documentedRule) NeedsTypeChecker() bool { return false }

func (documentedRule) VisitsDeclarationFiles() bool { return false }

func (documentedRule) Check(ctx *rule.Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil || node == nil {
    return
  }
  if node.Kind != shimast.KindSourceFile {
    return
  }
  selected, problems := decodeDocumentedOptions(ctx.Options)
  if len(problems) != 0 {
    for _, problem := range problems {
      if !firstDocumentedCycleDiagnostic(ctx, problem) {
        continue
      }
      ctx.Report(node, problem)
    }
    return
  }
  for _, host := range documentedHosts(ctx.File) {
    if !selected.contains(host.Symbol) {
      continue
    }
    blocks := host.documentation(ctx.File)
    // Every finding anchors on the declaration rather than on a block.
    // `Report` skips a node's leading trivia, and a JSDoc node is entirely
    // trivia to the declaration it precedes, so anchoring there asks the
    // host to underline the range it is built to skip past.
    switch {
    case len(blocks.Content) != 0:
      continue
    case len(blocks.Empty) != 0:
      ctx.Report(
        host.Node,
        "Empty JSDoc on "+host.describe()+
          ". The block states nothing and carries no tag, so it documents nothing and cites nothing. Describe what this declaration is for, or cite its evidence with '@evidence <target> <reason>'.",
      )
    default:
      ctx.Report(
        host.Node,
        "Missing JSDoc on "+host.describe()+
          ". An '@evidence' tag is only ever read from a JSDoc block, so without one this declaration can never cite anything. Add a '/** ... */' block above it.",
      )
    }
  }
}

// firstDocumentedCycleDiagnostic deduplicates configuration failures through
// the graph project rule's state, the only Program-cycle value the contributor
// API exposes to a file rule.
//
// Consumers normally enable documented beside graph, as the package's canonical
// configuration does. If graph is absent or off there is no cycle identity to
// coordinate through; reporting in every visited file is deliberately safer
// than suppressing a configuration failure across an unknown later cycle.
func firstDocumentedCycleDiagnostic(ctx *rule.Context, message string) bool {
  if ctx == nil {
    return false
  }
  result := ctx.ProjectResult(graphRuleName)
  cycle, ok := result.State.(*graphCycleState)
  if !ok || cycle == nil {
    return true
  }
  return cycle.Diagnostics.first(documentedRuleName + "\x00" + message)
}

func init() { rule.Register(documentedRule{}) }

func decodeDocumentedOptions(raw json.RawMessage) (symbolSet, []string) {
  options := documentedOptions{}
  if len(strings.TrimSpace(string(raw))) != 0 {
    if err := json.Unmarshal(raw, &options); err != nil {
      return nil, []string{
        "Invalid evidence/documented configuration: expected an ITtscEvidenceDocumentedConfig object, or a bare severity for the default selection.",
      }
    }
    if problems := rejectUnknownDocumentedFields(raw); len(problems) != 0 {
      return nil, problems
    }
  }
  selected, problems := decodeSymbols(
    options.Symbol,
    artifactTypeScript,
    false,
    documentedRuleName,
    "symbol",
  )
  if len(problems) != 0 {
    return nil, problems
  }
  return selected, nil
}

func rejectUnknownDocumentedFields(raw json.RawMessage) []string {
  object, problem := decodeObject(raw, "configuration")
  if problem != "" {
    return []string{
      "Invalid evidence/documented configuration: expected an ITtscEvidenceDocumentedConfig object, or a bare severity for the default selection.",
    }
  }
  return rejectUnknownFields(
    object,
    []string{"symbol"},
    documentedRuleName,
    "configuration",
  )
}

// documentedHost is one public identity that must carry a JSDoc block.
//
// The unit judged is an identity, never a declaration node. Declaration merging
// and overload sets give one identity several nodes — `interface I` beside
// `namespace I`, a callable beside its signatures — and judging the nodes would
// demand a block on every half of the very idiom `evidence/singular` blesses.
//
// Nodes holds them in source order, so Node is the declaration that founds the
// identity and the only one the rule reads.
type documentedHost struct {
  Node    *shimast.Node
  Nodes   []*shimast.Node
  Symbol  string
  Targets []string
}

// documentationBlocks separates the blocks on one declaration by whether they
// say anything.
//
// Only a block with content documents, and only a block with content can hold a
// citation. An empty block keeps its own finding, because telling an author a
// block is missing while they are looking straight at one helps nobody.
type documentationBlocks struct {
  Content []*shimast.Node
  Empty   []*shimast.Node
}

// documentation reads the blocks on the declaration that founds this identity.
//
// Only the first declaration is read. A merged identity is whatever its first
// declaration says it is, so a block on a later half neither satisfies the
// first nor counts against it — one unconditional rule, with nothing further to
// police.
func (host documentedHost) documentation(
  file *shimast.SourceFile,
) documentationBlocks {
  blocks := documentationBlocks{}
  if host.Node == nil {
    return blocks
  }
  content := file.Text()
  for _, doc := range host.Node.JSDoc(file) {
    if doc == nil || doc.Pos() < 0 || doc.End() > len(content) {
      continue
    }
    if jsdocHasContent(content[doc.Pos():doc.End()]) {
      blocks.Content = append(blocks.Content, doc)
      continue
    }
    blocks.Empty = append(blocks.Empty, doc)
  }
  return blocks
}

func (host documentedHost) describe() string {
  return "exported " + host.Symbol + " '" +
    strings.Join(host.Targets, "', '") + "'"
}

// documentedHosts lists the public identities of a file in source order.
//
// Both the population and its qualified names come from the collector
// `evidence/graph` uses. The population that must be able to hold a tag is by
// definition the population a claim can select as a host, and the name a
// diagnostic asks the author to cite has to be the name the graph resolves — a
// second walk here would let either drift, and the rule would then guarantee
// the wrong set under the wrong names.
func documentedHosts(file *shimast.SourceFile) []documentedHost {
  inventory := &artifactInventory{
    Type:      artifactTypeScript,
    UnitNodes: map[string][]*shimast.Node{},
  }
  supported := map[*shimast.Node]symbolSet{}
  collectTypeScriptStatements(
    file,
    file.Statements,
    nil,
    "",
    inventory,
    supported,
    map[string]*evidenceUnit{},
    file.IsDeclarationFile,
    false,
    false,
    "",
  )
  hosts := make([]documentedHost, 0, len(inventory.Units))
  for _, unit := range inventory.Units {
    if unit.Hidden != "" {
      continue
    }
    nodes := hostNodesOf(inventory.UnitNodes[unit.ID], supported, unit.Symbol)
    if len(nodes) == 0 {
      continue
    }
    hosts = append(hosts, documentedHost{
      Node:    nodes[0],
      Nodes:   nodes,
      Symbol:  unit.Symbol,
      Targets: []string{unit.Target},
    })
  }
  sort.Slice(hosts, func(left int, right int) bool {
    return hosts[left].Node.Pos() < hosts[right].Node.Pos()
  })
  return orderIdentityDeclarations(mergeSharedBlockHosts(hosts))
}

// hostNodesOf keeps the declarations that can actually carry a citation.
//
// A name can be spelled by a declaration that hosts nothing: a class is not a
// type unit, so `class C` beside `namespace C` materializes the `C` type from
// the namespace alone, and the collector registers no host for the class at
// all. Demanding the block there would send an author's `@evidence` into a
// position where `evidence/graph` rejects it as an unsupported host — the rule
// steering citations somewhere a citation cannot live, which is the failure it
// exists to prevent.
//
// Narrowing to real hosts also keeps this rule's premise exact. The population
// that must be able to hold a tag is the population a claim can select as a
// host, and nothing wider.
func hostNodesOf(
  nodes []*shimast.Node,
  supported map[*shimast.Node]symbolSet,
  symbol string,
) []*shimast.Node {
  hosts := make([]*shimast.Node, 0, len(nodes))
  for _, node := range nodes {
    if supported[node].contains(symbol) {
      hosts = append(hosts, node)
    }
  }
  return hosts
}

// orderIdentityDeclarations puts each identity's declarations in source order.
//
// The collector records them as it walks, and the merged forms are folded in
// afterwards, so the slice arrives in neither order. Placement is defined
// against the declaration that comes first, so that has to be `Node` — and for
// a variable the enclosing statement wins over its binding, which is where
// TypeScript actually attaches the block.
func orderIdentityDeclarations(hosts []documentedHost) []documentedHost {
  for index := range hosts {
    nodes := hosts[index].Nodes
    sort.SliceStable(nodes, func(left int, right int) bool {
      return nodes[left].Pos() < nodes[right].Pos()
    })
    if len(nodes) != 0 {
      hosts[index].Node = nodes[0]
    }
  }
  return hosts
}

// mergeSharedBlockHosts folds identities that can only ever share one block.
//
// `export const a = 1, b = 2;` declares two identities, and TypeScript gives
// the statement a single JSDoc position serving both. They are two obligations
// with one repair, so reporting each separately tells the author the same thing
// twice — the duplication this project's diagnostics deliberately avoid.
func mergeSharedBlockHosts(hosts []documentedHost) []documentedHost {
  merged := make([]documentedHost, 0, len(hosts))
  byStatement := map[*shimast.Node]int{}
  for _, host := range hosts {
    statement := sharedVariableStatement(host)
    if statement == nil {
      merged = append(merged, host)
      continue
    }
    if index, seen := byStatement[statement]; seen &&
      merged[index].Symbol == host.Symbol {
      merged[index].Targets = append(merged[index].Targets, host.Targets...)
      continue
    }
    byStatement[statement] = len(merged)
    merged = append(merged, host)
  }
  return merged
}

func sharedVariableStatement(host documentedHost) *shimast.Node {
  for _, node := range host.Nodes {
    if node != nil && node.Kind == shimast.KindVariableStatement {
      return node
    }
  }
  return nil
}

// jsdocHasContent reports whether a block says anything at all.
//
// Blocks are read through the same accessor the tag collector uses, so the rule
// accepts exactly what a citation could be found in. Accepting anything wider
// would pass a comment the graph cannot read, which is the silence this rule
// exists to remove.
func jsdocHasContent(comment string) bool {
  comment = strings.TrimSpace(comment)
  comment = strings.TrimPrefix(comment, "/**")
  comment = strings.TrimPrefix(comment, "/*")
  comment = strings.TrimSuffix(comment, "*/")
  for _, line := range strings.Split(comment, "\n") {
    line = strings.TrimSpace(line)
    line = strings.TrimSpace(strings.TrimPrefix(line, "*"))
    if line != "" {
      return true
    }
  }
  return false
}
