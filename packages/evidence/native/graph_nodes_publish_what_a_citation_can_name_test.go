package evidence

import (
  "strings"
  "testing"
  "github.com/samchon/ttsc/packages/lint/rule"
)

// Verifies that the artifacts this
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
//     names, and containment.
// @evidence contracts/testing.md#behavioral-verification runGraphNodes exercises this case: TestGraphNodesPublishWhatACitationCanName verifies that the artifacts this rule already materialized reach a consumer as facts, and that nothing it decided goes with them. The original assertions check assert the document and its headings arrive with their kinds, readable names, and containment.
// @evidence contracts/testing.md#independent-expectations The graph reports; the linter judges. What crosses this boundary is what an artifact IS — its address, what kind of thing it is, its readable name, where it lives, and what contains it. What must never cross is what this rule concluded about it: coverage, exclusions, cardinality, a diagnostic. A consumer holding any of those would hold a second answer to a question this rule already answers as a compile error, and only one of the two would be maintained. Literal document and heading addresses, heading text, kinds, and allowed parents independently constrain the published nodes. The negative guard checks verdict words in addresses; it does not prove the absence of every possible verdict encoding.
// @evidence contracts/testing.md#distinguishing-cases Materialize a graph over a document with a selected file and headings. Take the published nodes. Assert the document and its headings arrive with their kinds, readable names, and containment. The assertions and inputs in this function retain its own failure identity.
// @evidence contracts/testing.md#execution-ownership TestGraphNodesPublishWhatACitationCanName is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runGraphNodes within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
