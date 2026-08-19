package evidence

import "github.com/samchon/ttsc/packages/lint/rule"

// GraphNodes publishes the artifacts this project's configured references
// selected, so a consumer can answer what a citation names rather than only who
// wrote it.
//
// It is a projection of the same corpus Hints projects, and it decides nothing:
// no coverage, no cardinality, no policy, no diagnostic crosses this boundary.
// Those are this rule's product and it already delivers them as compile errors;
// a consumer holding a second copy would hold an unmaintained one.
//
// Only selected units are published, which is what makes a document nobody
// configured a reference for contribute nothing. A withdrawn unit — one that
// named the tag it hid itself behind — is skipped for the same reason it is
// never selected: the rule's own answer is that it is not part of the surface.
//
// TypeScript units are not published. The graph already holds every TypeScript
// declaration as a real node resolved by the checker, and a second node for the
// same symbol under an evidence address would make one declaration two things.
func (graphRule) GraphNodes(ctx *rule.GraphContext) []rule.GraphNode {
  if ctx == nil {
    return nil
  }
  cycle, published := ctx.State.(*graphCycleState)
  if !published || cycle == nil {
    return nil
  }
  corpus := cycle.Corpus
  // Addresses of every materialized unit, so a parent can be named by the
  // address a citation would use rather than by the rule's internal id. A
  // parent outside the selected set resolves to nothing and the host clears it,
  // which leaves the child at the top of its chain instead of inventing one.
  addresses := map[string]string{}
  for _, inventories := range []map[string]*artifactInventory{
    corpus.Markdown,
    corpus.Prisma,
    corpus.Swagger,
  } {
    for _, inventory := range inventories {
      if inventory == nil {
        continue
      }
      for _, unit := range inventory.Units {
        if unit != nil {
          addresses[unit.ID] = unit.Target
        }
      }
    }
  }

  selected := selectedCompletionUnits(
    corpus.Config,
    corpus.Markdown,
    corpus.Prisma,
    corpus.Swagger,
    false,
  )
  nodes := make([]rule.GraphNode, 0, len(selected))
  for _, unit := range selected {
    if unit == nil || unit.Hidden != "" {
      continue
    }
    kind, ok := graphNodeKindOf(unit)
    if !ok {
      continue
    }
    nodes = append(nodes, rule.GraphNode{
      Address:  unit.Target,
      Kind:     kind,
      Readable: unit.Readable,
      Parent:   addresses[unit.ParentID],
      File:     unit.Path,
      Line:     unit.Line,
      Aliases:  unit.Aliases,
    })
  }
  return nodes
}

// graphNodeKindOf maps one materialized unit onto the host's node vocabulary.
//
// The symbol is the rule's own selector, so this is a translation rather than a
// re-derivation: a Prisma relation is its own kind because the parser already
// separated it from a column, and a Markdown file is its own kind because the
// heading walk already separated it from a heading.
//
// A TypeScript unit reports false. So does an unrecognized symbol: guessing
// would publish a node under a kind a consumer would then rank and contain as
// something it is not.
func graphNodeKindOf(unit *evidenceUnit) (rule.GraphNodeKind, bool) {
  switch unit.Type {
  case artifactMarkdown:
    if unit.Symbol == "file" {
      return rule.GraphNodeMarkdownDocument, true
    }
    return rule.GraphNodeMarkdownSection, true
  case artifactPrisma:
    switch unit.Symbol {
    case "model":
      return rule.GraphNodePrismaModel, true
    case "relation":
      return rule.GraphNodePrismaRelation, true
    case "column":
      return rule.GraphNodePrismaColumn, true
    }
    return "", false
  case artifactSwagger:
    if unit.Symbol == "operation" {
      return rule.GraphNodeSwaggerOperation, true
    }
    return "", false
  }
  return "", false
}
