package graph

import (
  "path/filepath"
  "strings"
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
//  4. Declare the same name in two more modules that flank it alphabetically,
//     import all three, and assert every link resolves to the one this module
//     imports the name from — the claim the rest of the file now rests on,
//     since three declarations of `ISale` exist here.
func TestDocRefsResolveDocumentationLinks(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  // Two rivals, one sorting before `sale` and one after, each imported so the
  // program holds it. One rival is not enough: a text matcher has to break the
  // tie somehow, and whichever end it picks — lowest id, highest id, first or
  // last in program order — a single rival leaves half of those choices landing
  // on the right answer by luck. Flanking the real module closes every one.
  writeFile(t, filepath.Join(root, "src", "archive.ts"), `export interface ISale {
  archived: boolean;
}

export interface IArchive {
  flag: boolean;
}
`)
  writeFile(t, filepath.Join(root, "src", "vendor.ts"), `export interface ISale {
  vendored: boolean;
}

export interface IVendor {
  flag: boolean;
}
`)
  writeFile(t, filepath.Join(root, "src", "sale.ts"), `export interface ISale {
  price: number;
}

export namespace Shopping {
  export interface ICoupon {
    code: string;
  }
}
`)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `// The real module is imported between its two rivals, so no end of the import
// order is the right answer either.
import type { IArchive } from "./archive";
import type { ISale, Shopping } from "./sale";
import type { IVendor } from "./vendor";



/** @evidence {@link ISale} Cited from a tag. */
export function fromTag(): void {}

/** Ordinary prose naming {@link ISale} with no tag at all. */
export function fromProse(): void {}

/** @evidence {@linkcode ISale} Code form. */
export function fromCode(): void {}

/** @evidence {@linkplain ISale} Plain form. */
export function fromPlain(): void {}

/** Two links, {@link ISale} and {@link Shopping.ICoupon}, plus {@link ISale} twice. */
export function severalLinks(): void {}

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

/** Names {@link ISale}, of which this file imports exactly one. */
export function ambiguousName(): void {}

/** Names {@link IArchive}, which only the first rival declares. */
export function usesArchive(): void {}

/** Names {@link IVendor}, which only the second rival declares. */
export function usesVendor(): void {}

/** Names a library type: {@link Promise}. */
export function linksExternal(): void {}


/** A class documented with {@link ISale} on the class itself. */
export class Documented {
  /** @evidence {@link Shopping.ICoupon} On the member, not the class. */
  public readonly coupon: string = "";

  /** Method documentation naming {@link ISale}. */
  public run(): void {}
}

/** An interface documented with {@link ISale}. */
export interface IDocumented {
  value: number;
}

/** A namespace documented with {@link ISale}. */
export namespace Documented2 {
  export const value = 1;
}
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

  assertDocRef(t, g, "#fromTag:function", "sale.ts#ISale:interface")
  // The tag decides nothing: a link in ordinary prose is the same relation.
  assertDocRef(t, g, "#fromProse:function", "sale.ts#ISale:interface")
  assertDocRef(t, g, "#fromCode:function", "sale.ts#ISale:interface")
  assertDocRef(t, g, "#fromPlain:function", "sale.ts#ISale:interface")
  // Distinct targets each get an edge; a target named twice collapses under the
  // uniqueness rule every edge kind shares, keeping the first span.
  assertDocRef(t, g, "#severalLinks:function", "sale.ts#ISale:interface")
  assertDocRef(t, g, "#severalLinks:function", "#Shopping.ICoupon:interface")
  assertDocRef(t, g, "#fromQualified:function", "#Shopping.ICoupon:interface")
  // A link under a tag TypeScript recognizes is the same relation. Reading a
  // tag's comment through its per-kind struct crashed on the first `@param`
  // instead, so this case and the one below are one fix and one regression.
  assertDocRef(t, g, "#fromSee:function", "sale.ts#ISale:interface")

  // A name the checker cannot resolve is not a relation, and must not
  // fabricate a node to point at.
  assertNoDocRef(t, g, "#fromUnresolved:function")
  // A declaration naming itself is not an edge, the same rule typeRefEdge keeps.
  assertNoDocRef(t, g, "#selfLinked:function")
  assertNoDocRef(t, g, "#noLink:function")
  assertNoDocRef(t, g, "#withKnownTags:function")

  // A class, an interface, and a namespace carry documentation of their own,
  // and the container walk the edge pass would naturally reuse never visits any
  // of them as a node: it descends straight into their members. Each of these
  // resolved to nothing while the tag beside it was indexed, so the two halves
  // a reader composes disagreed exactly where a type is documented.
  assertDocRef(t, g, "#Documented:class", "sale.ts#ISale:interface")
  assertDocRef(t, g, "#IDocumented:interface", "sale.ts#ISale:interface")
  // A namespace is a grouping container the graph models as no node at all, so
  // its own documentation has nothing to hang on — and the tag half agrees,
  // because `putDeclaredNode` is never called for one either. The two halves
  // being absent together is the invariant; one of them answering alone is the
  // defect this pairing exists to catch.
  assertNoNamespaceNode(t, g, "#Documented2:")
  assertNoDocRefTo(t, g, "#Documented2.value:variable", "sale.ts#ISale:interface")

  // A member's link belongs to the member. The same walk hands a property's
  // subtree to its class as well, which is right for dependency edges and wrong
  // here: the class's own documentation names nothing.
  assertDocRef(t, g, "#Documented.coupon:variable", "#Shopping.ICoupon:interface")
  assertNoDocRefTo(t, g, "#Documented:class", "#Shopping.ICoupon:interface")
  assertDocRef(t, g, "#Documented.run:method", "sale.ts#ISale:interface")

  // Two modules declare `ISale`, and only the checker knows which one a link
  // means: it resolves the name through this module's imports. A text match on
  // the written token could not tell them apart, and would have to guess.
  assertNodeExists(t, g, "archive.ts#ISale:interface")
  assertNodeExists(t, g, "vendor.ts#ISale:interface")
  // Each rival is reached for a name only it declares, which is what keeps its
  // import from being the kind a stricter project would remove.
  assertDocRef(t, g, "#usesArchive:function", "archive.ts#IArchive:interface")
  assertDocRef(t, g, "#usesVendor:function", "vendor.ts#IVendor:interface")
  assertDocRef(t, g, "#ambiguousName:function", "sale.ts#ISale:interface")
  assertNoDocRefTo(t, g, "#ambiguousName:function", "archive.ts#ISale:interface")
  assertNoDocRefTo(t, g, "#ambiguousName:function", "vendor.ts#ISale:interface")

  // A link to a library type follows the external-boundary policy every other
  // edge kind keeps: the target is a named endpoint, not walked into.
  assertExternalDocRef(t, g, "#linksExternal:function", "Promise")
}

// assertExternalDocRef fails unless exactly one doc_ref edge leaves the node and
// lands on an external declaration of this name.
func assertExternalDocRef(t *testing.T, g *Graph, fromSuffix, name string) {
  t.Helper()
  found := 0
  for _, edge := range g.Edges {
    if edge.Kind != EdgeDocRef || !suffixMatch(edge.From, fromSuffix) {
      continue
    }
    target := g.Nodes[edge.To]
    if target == nil {
      t.Fatalf("%s cited %s, which is no node", fromSuffix, edge.To)
    }
    if target.Simple != name {
      continue
    }
    found++
    if !target.External {
      t.Fatalf("%s is a library declaration and must be an external boundary leaf", edge.To)
    }
  }
  if found != 1 {
    t.Fatalf("%s -> external %s edges = %d, want 1", fromSuffix, name, found)
  }
}

// assertNoNamespaceNode fails when the graph holds a node for this namespace,
// or any doc_ref edge leaving one.
//
// A suffix match cannot express this: every node id ends in its kind, so
// "#Documented2:" is a suffix of nothing and an assertion written that way
// passes against an implementation that records the namespace and cites from
// it — the exact defect the pairing exists to catch.
func assertNoNamespaceNode(t *testing.T, g *Graph, infix string) {
  t.Helper()
  for id := range g.Nodes {
    if strings.Contains(id, infix) {
      t.Fatalf("graph recorded %s; a namespace is modelled as no node, so its documentation has no host", id)
    }
  }
  for _, edge := range g.Edges {
    if edge.Kind == EdgeDocRef && strings.Contains(edge.From, infix) {
      t.Fatalf("a namespace node cited %s", edge.To)
    }
  }
}

// assertNodeExists fails unless the graph holds a node whose id ends this way.
// It guards the same-name case from passing because the rival never existed.
func assertNodeExists(t *testing.T, g *Graph, suffix string) {
  t.Helper()
  for id := range g.Nodes {
    if suffixMatch(id, suffix) {
      return
    }
  }
  t.Fatalf("the graph holds no %s, so a resolution asserted against it proves nothing", suffix)
}

// assertNoDocRefTo fails when a doc_ref edge runs between these two nodes.
func assertNoDocRefTo(t *testing.T, g *Graph, fromSuffix, toSuffix string) {
  t.Helper()
  for _, edge := range g.Edges {
    if edge.Kind == EdgeDocRef &&
      suffixMatch(edge.From, fromSuffix) &&
      suffixMatch(edge.To, toSuffix) {
      t.Fatalf("%s must not name %s", fromSuffix, toSuffix)
    }
  }
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
