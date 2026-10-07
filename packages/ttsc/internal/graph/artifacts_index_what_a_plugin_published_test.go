package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestArtifactsIndexWhatAPluginPublished verifies that a published artifact
// becomes a node a citation resolves to. Four accepted authored records add
// nodes, while the unknown kind, unpublished cited address and unpublished
// parent do not. It exercises the native graph builder and direct publication;
// no plugin publisher or consumer query runs.
//
// Every negative here is a way the index could lie. A fabricated node for an
// address nobody published would answer a question with an invention; a parent
// naming nothing would put an artifact under a container that does not exist;
// and an unknown kind would be ranked and contained as something it is not.
//
//  1. Build a graph for a project whose declarations cite four addresses.
//  2. Apply a published set covering three of them, one by an alias, one under
//     a parent, plus an unpublishable entry.
//  3. Assert the nodes, their containment, and the resolved edges — and that the
//     unpublished cited address, unknown kind, and dangling parent produced none.
//
// @evidence contracts/testing.md#behavioral-verification Direct ApplyArtifacts adds the four accepted literal addresses and resolves authored citations to canonical artifact nodes; the unknown kind and unpublished cited or parent addresses add no nodes.
// @evidence contracts/testing.md#independent-expectations The expectations are literal over a fixture citing four addresses: applying five published records must add exactly four nodes (the unknown kind adds none), no node for the unpublished cited address or the unpublished parent prisma:Sale, the Pricing section must carry the readable text Pricing, line 7 and parent docs/sale.md, a parent naming no published node must be cleared, doc-ref edges must land on the pricing section (twice: its address and its alias) and the prisma column, and the shadowing alias must claim nothing.
// @evidence contracts/testing.md#distinguishing-cases The fixture contrasts canonical and alias citations, a published and missing parent, an unknown kind and accepted kinds, an unpublished cited address, and an alias that attempts to shadow an existing canonical address.
// @evidence contracts/testing.md#execution-ownership This graph Go source-unit writes its temporary project, constructs and closes a driver compiler Program in-process, then calls Build and ApplyArtifacts directly. A restored empty linked-plugin manifest excludes ambient hooks. It installs no consumer and builds or starts no native product command.
func TestArtifactsIndexWhatAPluginPublished(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "target": "ES2022", "module": "commonjs", "strict": true },
  "files": ["src/main.ts"]
}
`)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `/** @evidence docs/sale.md#pricing States the rule. */
export function priced(): void {}

/** @evidence prisma:Sale.price The column it reads. */
export function column(): void {}

/** @evidence docs/sale.md#alias Reached by its other name. */
export function aliased(): void {}

/** @evidence docs/sale.md#nobody-published-this Still just text. */
export function unpublished(): void {}
`)

  prog, _, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil || prog == nil {
    t.Fatalf("could not load the probe project: %v", err)
  }
  defer func() { _ = prog.Close() }()

  g := Build(prog)
  before := len(g.Nodes)
  ApplyArtifacts(g, []Artifact{
    {
      Address:  "docs/sale.md",
      Kind:     "markdown_document",
      Readable: "Sale",
      File:     "docs/sale.md",
      Line:     1,
    },
    {
      Address:  "docs/sale.md#pricing",
      Kind:     "markdown_section",
      Readable: "Pricing",
      Parent:   "docs/sale.md",
      File:     "docs/sale.md",
      Line:     7,
      Aliases:  []string{"docs/sale.md#alias"},
    },
    {
      Address:  "prisma:Sale.price",
      Kind:     "prisma_column",
      Readable: "Prisma column 'Sale.price'",
      Parent:   "prisma:Sale",
      File:     "prisma/schema.prisma",
      Line:     12,
    },
    {Address: "docs/sale.md#unknown", Kind: "not_a_kind"},
    // Its alias is another artifact's own address. An alias is an additional
    // name for one artifact, never a rename of another, so this must not move
    // `docs/sale.md#pricing` onto this node — a citation of that address would
    // then resolve to the wrong section, which is a confident wrong answer.
    {
      Address:  "docs/sale.md#shadow",
      Kind:     "markdown_section",
      Readable: "Shadow",
      Aliases:  []string{"docs/sale.md#pricing"},
      File:     "docs/sale.md",
      Line:     20,
    },
  })

  if got := len(g.Nodes) - before; got != 4 {
    t.Fatalf("added %d nodes, want 4; an unknown kind must contribute none", got)
  }
  for _, address := range []string{"docs/sale.md", "docs/sale.md#pricing", "prisma:Sale.price", "docs/sale.md#shadow"} {
    if g.Nodes[address] == nil {
      t.Fatalf("accepted artifact %q has no node", address)
    }
  }
  if _, fabricated := g.Nodes["docs/sale.md#unknown"]; fabricated {
    t.Fatal("an unknown artifact kind became a node")
  }
  if _, fabricated := g.Nodes["docs/sale.md#nobody-published-this"]; fabricated {
    t.Fatal("an address nobody published became a node; the tag text carries it and the linter judges it")
  }
  if _, fabricated := g.Nodes["prisma:Sale"]; fabricated {
    t.Fatal("a parent nobody published became a node")
  }

  section := g.Nodes["docs/sale.md#pricing"]
  if section == nil {
    t.Fatal("the cited section is not a node")
  }
  if section.Simple != "Pricing" {
    t.Fatalf("the section carries %q, not the heading text an index exists to hold", section.Simple)
  }
  if section.ArtifactLine != 7 {
    t.Fatalf("the section starts at line %d, want 7", section.ArtifactLine)
  }
  if section.ArtifactParent != "docs/sale.md" {
    t.Fatalf("the section's parent is %q, want its document", section.ArtifactParent)
  }
  if parent := g.Nodes["prisma:Sale.price"].ArtifactParent; parent != "" {
    t.Fatalf("a parent naming no published node survived as %q; it must be cleared, not fabricated", parent)
  }

  cited := map[string]bool{}
  for _, edge := range g.Edges {
    if edge.Kind == EdgeDocRef {
      cited[edge.To] = true
    }
  }
  for _, address := range []string{"docs/sale.md#pricing", "prisma:Sale.price"} {
    if !cited[address] {
      t.Fatalf("no doc-ref edge resolved to %q", address)
    }
  }
  if cited["docs/sale.md#alias"] {
    t.Fatal("an alias became its own edge target; it has to resolve to the one node")
  }
  // The alias resolves to the same node, so the declaration citing it and the
  // declaration citing the canonical address point at one artifact.
  aliasEdges := 0
  for _, edge := range g.Edges {
    if edge.Kind == EdgeDocRef && edge.To == "docs/sale.md#pricing" {
      aliasEdges++
    }
  }
  if aliasEdges != 2 {
    t.Fatalf("%d declarations resolved to the section, want 2 (its address and its alias)", aliasEdges)
  }
  for _, edge := range g.Edges {
    if edge.Kind == EdgeDocRef && edge.To == "docs/sale.md#shadow" {
      t.Fatal("an alias claimed another artifact's address; a citation resolved to the wrong node")
    }
  }
}
