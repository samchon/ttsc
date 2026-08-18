package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDocRefsResolveDocumentationLinks verifies that an inline link in a
// declaration's documentation becomes a checker-resolved edge, and that the tag
// it sits under changes nothing.
//
// The checker already resolves such a name and counts it as a use — the
// companion negative case is a project where `noUnusedLocals` keeps an import
// that only a link supports — so this was the one class of resolved reference
// the graph held no edge for, and the citation-only `import type` a citation
// convention recommends is exactly the form nothing else in the module records.
//
//  1. Build a fixture linking one type from a tag, one from ordinary prose, one
//     through `{@linkcode}`, one qualified, and one that resolves to nothing.
//  2. Assert each resolvable link produced exactly one doc_ref edge to the
//     declaration the checker resolved.
//  3. Assert the unresolvable link, the self-link, and the untagged declaration
//     produced none.
func TestDocRefsResolveDocumentationLinks(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "sale.ts"), `export interface ISale {
  price: number;
}

export namespace Shopping {
  export interface ICoupon {
    code: string;
  }
}
`)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `import type { ISale, Shopping } from "./sale";

/** @evidence {@link ISale} Cited from a tag. */
export function fromTag(): void {}

/** Ordinary prose naming {@link ISale} with no tag at all. */
export function fromProse(): void {}

/** @evidence {@linkcode ISale} Code form. */
export function fromCode(): void {}

/** @evidence {@link Shopping.ICoupon} Qualified. */
export function fromQualified(): void {}

/** @evidence {@link NoSuchSymbol} Resolves to nothing. */
export function fromUnresolved(): void {}

/** @see {@link ISale} A tag TypeScript does know. */
export function fromSee(): void {}

/**
 * @param value The parameter, whose tag carries no link.
 * @returns Nothing.
 */
export function withKnownTags(value: string): void {}

/** Names {@link selfLinked} itself. */
export function selfLinked(): void {}

/** Carries documentation but no link. */
export function noLink(): void {}
`)

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %v", diags)
  }
  defer func() { _ = prog.Close() }()

  g := Build(prog)

  assertDocRef(t, g, "#fromTag:function", "#ISale:interface")
  // The tag decides nothing: a link in ordinary prose is the same relation.
  assertDocRef(t, g, "#fromProse:function", "#ISale:interface")
  assertDocRef(t, g, "#fromCode:function", "#ISale:interface")
  assertDocRef(t, g, "#fromQualified:function", "#Shopping.ICoupon:interface")
  // A link under a tag TypeScript recognizes is the same relation. Reading a
  // tag's comment through its per-kind struct crashed on the first `@param`
  // instead, so this case and the one below are one fix and one regression.
  assertDocRef(t, g, "#fromSee:function", "#ISale:interface")

  // A name the checker cannot resolve is not a relation, and must not
  // fabricate a node to point at.
  assertNoDocRef(t, g, "#fromUnresolved:function")
  // A declaration naming itself is not an edge, the same rule typeRefEdge keeps.
  assertNoDocRef(t, g, "#selfLinked:function")
  assertNoDocRef(t, g, "#noLink:function")
  assertNoDocRef(t, g, "#withKnownTags:function")
}

// assertDocRef fails unless exactly one doc_ref edge runs between the two nodes
// whose ids end with these suffixes, carrying a span.
func assertDocRef(t *testing.T, g *Graph, fromSuffix, toSuffix string) {
  t.Helper()
  found := 0
  for _, edge := range g.Edges {
    if edge.Kind != EdgeDocRef {
      continue
    }
    if suffixMatch(edge.From, fromSuffix) && suffixMatch(edge.To, toSuffix) {
      found++
      if edge.Pos < 0 || edge.End <= edge.Pos {
        t.Fatalf("%s -> %s carries no span (%d..%d)", fromSuffix, toSuffix, edge.Pos, edge.End)
      }
    }
  }
  if found != 1 {
    t.Fatalf("%s -> %s doc_ref edges = %d, want 1", fromSuffix, toSuffix, found)
  }
}

// assertNoDocRef fails when any doc_ref edge leaves the named node.
func assertNoDocRef(t *testing.T, g *Graph, fromSuffix string) {
  t.Helper()
  for _, edge := range g.Edges {
    if edge.Kind == EdgeDocRef && suffixMatch(edge.From, fromSuffix) {
      t.Fatalf("%s produced an unexpected doc_ref edge to %s", fromSuffix, edge.To)
    }
  }
}
