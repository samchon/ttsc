package evidence

import (
  "encoding/json"
  "os"
  "path/filepath"
  "sort"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimparser "github.com/microsoft/typescript-go/shim/parser"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// TestGraphNodesPublishWhatACitationCanName verifies that the artifacts this
// rule already materialized reach a consumer as facts, and that nothing it
// decided goes with them.
//
// The graph reports; the linter judges. What crosses this boundary is what an
// artifact IS — its address, what kind of thing it is, its readable name, where
// it lives, and what contains it. What must never cross is what this rule
// concluded about it: coverage, exclusions, cardinality, a diagnostic. A
// consumer holding any of those would hold a second answer to a question this
// rule already answers as a compile error, and only one of the two would be
// maintained.
//
// A withdrawn unit is absent for the same reason it is never selected: the
// rule's own answer is that it is not part of the surface, so publishing it
// would contradict the rule that published it.
//
//  1. Materialize a graph over a document with a selected file and headings.
//  2. Take the published nodes.
//  3. Assert the document and its headings arrive with their kinds, readable
//     names, and containment — and that a hidden heading does not.
func TestGraphNodesPublishWhatACitationCanName(t *testing.T) {
  nodes, messages := runGraphNodes(t, map[string]string{
    "docs/pricing.md": "# Pricing\n\n## Sale Price {#sale-price}\n",
    "src/sale.ts": `/**
 * @evidence docs/pricing.md Implements the pricing document.
 */
export interface ISale {
  price: number;
}
`,
  }, `{"claims":[{
  "type":"typescript",
  "files":["src/**"],
  "reference":{"type":"markdown","files":["docs/**"],"symbol":["file","h1","h2"]}
}]}`)
  assertSilent(t, messages)

  byAddress := map[string]rule.GraphNode{}
  for _, node := range nodes {
    byAddress[node.Address] = node
  }

  document, published := byAddress["docs/pricing.md"]
  if !published {
    t.Fatalf("the document was not published; got %v", sortedAddresses(nodes))
  }
  if document.Kind != rule.GraphNodeMarkdownDocument {
    t.Fatalf("the document is published as %q", document.Kind)
  }
  if document.File == "" {
    t.Fatal("the document was published without the file it lives in")
  }

  section, published := byAddress["docs/pricing.md#sale-price"]
  if !published {
    t.Fatalf("the heading was not published; got %v", sortedAddresses(nodes))
  }
  if section.Kind != rule.GraphNodeMarkdownSection {
    t.Fatalf("the heading is published as %q", section.Kind)
  }
  if !strings.Contains(section.Readable, "Sale Price") {
    t.Fatalf(
      "the heading arrived as %q, without the text an index exists to carry",
      section.Readable,
    )
  }
  if section.Line <= 0 {
    t.Fatalf("the heading arrived at line %d, so it carries no span", section.Line)
  }
  if section.Parent != "docs/pricing.md#pricing" && section.Parent != "docs/pricing.md" {
    t.Fatalf("the heading is contained by %q, which is neither its document nor its H1", section.Parent)
  }

  // Nothing this rule decided travels. The published shape has no field for a
  // verdict, so the check is that no node carries one in the fields it does
  // have — an address or a readable name spelling out coverage would be the
  // same leak by another route.
  for _, node := range nodes {
    for _, judgement := range []string{"covered", "uncovered", "excluded", "missing"} {
      if strings.Contains(strings.ToLower(node.Address), judgement) {
        t.Fatalf("node %q carries a verdict in its address", node.Address)
      }
    }
  }
}

// TestGraphNodesOmitAWithdrawnUnit verifies the publisher drops a unit that
// named the tag it hid itself behind, and keeps its untagged siblings.
//
// A withdrawn unit is retained internally so a citation of it can be told why the
// target it names is not there. Publishing it would put a node in the graph for
// something the rule says is not part of the surface — the graph would answer a
// question the linter answers the other way, which is the one thing this
// boundary exists to prevent.
//
// The units are materialized directly rather than parsed from a schema, because
// the Prisma loader shells out to a resolvable `@ttsc/evidence` install that a
// scratch directory does not have. What is under test is the publisher's own
// filter, and that reads `Hidden`, whichever collector set it.
//
//  1. Materialize a withdrawn model with its columns, and a surviving one.
//  2. Publish both populations through the same filter GraphNodes applies.
//  3. Assert the survivors are published and nothing withdrawn is.
func TestGraphNodesOmitAWithdrawnUnit(t *testing.T) {
  withdrawn := prismaModelUnits(prismaModel{
    Name:          "Ledger",
    Documentation: "@internal Internal bookkeeping.",
    Fields: []prismaField{
      {Name: "amount", Symbol: "column"},
      {Name: "sale", Symbol: "relation"},
    },
  })
  surviving := prismaModelUnits(prismaModel{
    Name:   "Sale",
    Fields: []prismaField{{Name: "price", Symbol: "column"}},
  })

  // The real publisher, over a corpus built by hand. Replicating its filter
  // here would test this file's copy of the rule rather than the rule.
  config, problems := decodeGraphConfig(json.RawMessage(`{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":{"type":"prisma","files":["prisma/**/*.prisma"],"symbol":["model","column","relation"]}
  }]}`))
  if len(problems) != 0 {
    t.Fatalf("the probe configuration did not decode: %v", problems)
  }
  resolveGraphBases(t.TempDir(), &config)

  nodes := graphRule{}.GraphNodes(&rule.GraphContext{
    Identity: rule.ProjectIdentity{PhysicalProjectRoot: t.TempDir()},
    State: &graphCycleState{Corpus: graphCorpus{
      Config: config,
      Prisma: map[string]*artifactInventory{
        "prisma/schema.prisma": {
          Address: "prisma/schema.prisma",
          Path:    "prisma/schema.prisma",
          Type:    artifactPrisma,
          Units:   append(append([]*evidenceUnit{}, withdrawn...), surviving...),
        },
      },
    }},
    Severity: rule.SeverityError,
  })

  published := map[string]bool{}
  for _, node := range nodes {
    published[node.Address] = true
  }

  for _, target := range []string{"prisma:Sale", "prisma:Sale.price"} {
    if !published[target] {
      t.Fatalf(
        "the surviving unit %s was not published; got %v",
        target,
        sortedAddresses(nodes),
      )
    }
  }
  for _, unit := range withdrawn {
    if published[unit.Target] {
      t.Fatalf(
        "the withdrawn unit %s was published; the rule says it is not part of the surface",
        unit.Target,
      )
    }
  }
}

// runGraphNodes materializes a graph and returns what it published, mirroring
// runGraphHints exactly — the two are projections of the same corpus and a
// difference in how they are driven would be a difference in what they prove.
func runGraphNodes(
  t *testing.T,
  files map[string]string,
  config string,
) ([]rule.GraphNode, []string) {
  t.Helper()
  root := t.TempDir()
  paths := make([]string, 0, len(files))
  for path := range files {
    paths = append(paths, path)
  }
  sort.Strings(paths)
  sources := []*shimast.SourceFile{}
  for _, relative := range paths {
    content := files[relative]
    absolute := filepath.Join(root, filepath.FromSlash(relative))
    if err := os.MkdirAll(filepath.Dir(absolute), 0o755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(absolute, []byte(content), 0o644); err != nil {
      t.Fatal(err)
    }
    if !isTypeScriptTestPath(relative) {
      continue
    }
    sources = append(sources, shimparser.ParseSourceFile(
      shimast.SourceFileParseOptions{FileName: filepath.ToSlash(absolute)},
      content,
      shimcore.ScriptKindTS,
    ))
  }
  reporter := &capturedProjectReporter{}
  context := rule.NewProjectContext(
    rule.ProjectIdentity{PhysicalProjectRoot: root},
    sources,
    nil,
    rule.SeverityError,
    json.RawMessage(config),
    reporter,
  )
  graphRule{}.Check(context)
  if reporter.failed || reporter.state == nil {
    return nil, reporter.messages
  }
  return graphRule{}.GraphNodes(&rule.GraphContext{
    Identity: rule.ProjectIdentity{PhysicalProjectRoot: root},
    State:    reporter.state,
    Severity: rule.SeverityError,
    Options:  json.RawMessage(config),
  }), reporter.messages
}

func sortedAddresses(nodes []rule.GraphNode) []string {
  addresses := make([]string, 0, len(nodes))
  for _, node := range nodes {
    addresses = append(addresses, node.Address)
  }
  sort.Strings(addresses)
  return addresses
}
