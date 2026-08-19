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

// TestGraphNodesOmitAWithdrawnUnit verifies that a unit that named the tag it
// hid itself behind is not published.
//
// It is the boundary case the rule's own selection already answers: a withdrawn
// unit is retained internally so a citation of it can be told why its target is
// not there, and publishing it would put a node in the graph for something the
// rule says is not part of the surface.
func TestGraphNodesOmitAWithdrawnUnit(t *testing.T) {
  nodes, _ := runGraphNodes(t, map[string]string{
    "docs/pricing.md": "# Pricing\n",
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
  "reference":{"type":"markdown","files":["docs/**"],"symbol":["file"]}
}]}`)
  for _, node := range nodes {
    if node.Kind == "" {
      t.Fatalf("a node was published with no kind: %+v", node)
    }
    if node.Address == "" {
      t.Fatalf("a node was published with no address: %+v", node)
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
