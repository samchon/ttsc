package linthost

import (
  "reflect"
  "testing"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestGraphNodesDropsWhatAConsumerCannotIndex verifies the host's own filter over
// what a contributor published.
//
// The channel is contributor-agnostic, so the host cannot assume the set is
// well formed. Three shapes are unusable and one is repairable, and the
// difference matters: a node with no address has no identity to be cited by, a
// kind outside the published vocabulary is one a consumer would rank and contain
// as something it is not, and a repeated address makes a citation ambiguous.
// A rule's own aliases are how one artifact answers to two names. A parent
// naming nothing is the repairable one: the child is still a real artifact, so
// it is left at the top of its chain rather than dropped or given an invented
// parent.
//
//  1. Hand the filter a set carrying each unusable shape beside a valid node.
//  2. Assert only the valid nodes survive, first writer winning a duplicate.
//  3. Assert the dangling parent was cleared, not fabricated and not fatal.
//
// @evidence contracts/testing.md#behavioral-verification dropUnusableGraphNodes removes empty addresses and unsupported kinds, keeps the first of duplicate addresses in original order, preserves a published parent link and clears an unpublished Prisma parent without discarding its child or changing kind, readable text, source position or alias values.
// @evidence contracts/testing.md#independent-expectations Literal valid identities/kinds, the first-writer policy and resolvable-parent requirement define the complete expected survivor address sequence and parent fields. A literal complete node table separately requires kind, text, file, line and alias preservation during the parent repair; the expected set is authored rather than copied from a second filter call.
// @evidence contracts/testing.md#distinguishing-cases A valid document and child sit beside an empty-address section, invalid-kind section, duplicate child with different readable text and valid Prisma column with a missing parent, separating discard, duplicate precedence and repair behavior.
// @evidence contracts/testing.md#execution-ownership The actual native graph-node filter runs directly on authored GraphNode values in the Go process. Address strings are functional identity inputs without document existence checks, graph indexing hosts, native build or consumer installation.
func TestGraphNodesDropsWhatAConsumerCannotIndex(t *testing.T) {
  kept := dropUnusableGraphNodes([]publicrule.GraphNode{
    {Address: "docs/a.md", Kind: publicrule.GraphNodeMarkdownDocument, Readable: "Document A", File: "docs/a.md", Line: 1, Aliases: []string{"document-alias"}},
    {Address: "", Kind: publicrule.GraphNodeMarkdownSection},
    {Address: "docs/a.md#x", Kind: "not_a_kind"},
    {
      Address: "docs/a.md#y",
      Kind:    publicrule.GraphNodeMarkdownSection,
      Parent:  "docs/a.md",
      File:    "docs/a.md",
      Line:    2,
      Aliases: []string{"docs/a.md#first"},
    },
    {
      Address:  "docs/a.md#y",
      Kind:     publicrule.GraphNodeMarkdownSection,
      Readable: "a second node under one address",
    },
    {
      Address:  "prisma:Sale.price",
      Kind:     publicrule.GraphNodePrismaColumn,
      Parent:   "prisma:Sale",
      Readable: "price",
      File:     "schema.prisma",
      Line:     3,
      Aliases:  []string{"alternate-price"},
    },
  })

  wantNodes := []publicrule.GraphNode{
    {Address: "docs/a.md", Kind: publicrule.GraphNodeMarkdownDocument, Readable: "Document A", File: "docs/a.md", Line: 1, Aliases: []string{"document-alias"}},
    {Address: "docs/a.md#y", Kind: publicrule.GraphNodeMarkdownSection, Parent: "docs/a.md", File: "docs/a.md", Line: 2, Aliases: []string{"docs/a.md#first"}},
    {Address: "prisma:Sale.price", Kind: publicrule.GraphNodePrismaColumn, Readable: "price", File: "schema.prisma", Line: 3, Aliases: []string{"alternate-price"}},
  }
  if !reflect.DeepEqual(kept, wantNodes) {
    t.Fatalf("filter lost artifact meaning or failed its repair: got=%#v want=%#v", kept, wantNodes)
  }
  addresses := make([]string, 0, len(kept))
  for _, node := range kept {
    addresses = append(addresses, node.Address)
  }
  want := []string{"docs/a.md", "docs/a.md#y", "prisma:Sale.price"}
  if len(addresses) != len(want) {
    t.Fatalf("kept %v, want %v", addresses, want)
  }
  for index, address := range want {
    if addresses[index] != address {
      t.Fatalf("kept %v, want %v", addresses, want)
    }
  }

  byAddress := map[string]publicrule.GraphNode{}
  for _, node := range kept {
    byAddress[node.Address] = node
  }
  if byAddress["docs/a.md#y"].Readable != "" {
    t.Fatalf("the second node under one address won; the first writer has to")
  }
  if byAddress["docs/a.md#y"].Parent != "docs/a.md" {
    t.Fatalf("a parent that was published lost its link: %q", byAddress["docs/a.md#y"].Parent)
  }
  if byAddress["prisma:Sale.price"].Parent != "" {
    t.Fatalf(
      "a parent naming no published node survived as %q; it must be cleared rather than fabricated",
      byAddress["prisma:Sale.price"].Parent,
    )
  }
}
