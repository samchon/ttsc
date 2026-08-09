package evidence

import (
  "sort"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// hostPositionCorpus carries one citation on every declaration form that
// registers a host position.
//
// A tag is what makes a position observable from outside the collector: a
// declaration with hosts and no semantic identity is exactly the asymmetry this
// case exists to refuse, and it is visible only where a tag sits.
const hostPositionCorpus = `
/** @evidence docs/spec.md#a An interface. */
export interface ISale {
  /** @evidence docs/spec.md#a An interface member. */
  price: number;
  /** @evidence docs/spec.md#a A method signature. */
  run(): void;
}

/** @evidence docs/spec.md#a An object-shaped type alias. */
export type TSale = {
  /** @evidence docs/spec.md#a An alias member. */
  rate: number;
};

/** @evidence docs/spec.md#a A class. */
export class Sale {
  /** @evidence docs/spec.md#a A class field. */
  readonly total: number = 0;
  /** @evidence docs/spec.md#a A class method. */
  charge(): void {}
  constructor(
    /** @evidence docs/spec.md#a A parameter property. */
    public readonly currency: string,
  ) {}
}

/** @evidence docs/spec.md#a A function declaration. */
export function draw(): void {}

/** @evidence docs/spec.md#a A variable statement. */
export const limit = 1;

export const alpha = 2,
  /** @evidence docs/spec.md#a An inner declarator. */
  beta = 3;

/** @evidence docs/spec.md#a A namespace. */
export namespace Orders {
  /** @evidence docs/spec.md#a A namespace type. */
  export interface Input {
    id: string;
  }
  /** @evidence docs/spec.md#a A namespace function. */
  export function run(): void {}
  /** @evidence docs/spec.md#a A namespace variable. */
  export const state = "ready";
}

/** @evidence docs/spec.md#a A dotted namespace. */
export namespace Outer.Inner {
  export interface Nested {
    id: string;
  }
}
`

/**
 * Verifies every host position a declaration form registers belongs to a unit.
 *
 * This is the invariant behind two separate silent failures, rather than one
 * more shape beside them. `supportedHosts` is keyed by node while every
 * consumer that matters walks from a unit to its declarations, so a position in
 * the first set and in no unit's node list is invisible to all of them: the
 * withdrawal reconciliation cannot take it away, and a citation on it resolves
 * to no semantic identity, so the per-host policies and the review ledger both
 * count it as nothing while the obligation it discharged reports satisfied. The
 * variable declarator was the position that had it, and it was found by writing
 * a citation rather than by reading.
 *
 * The two sets are compared directly rather than through a citation. A tag
 * reaches exactly one node, so a corpus of tagged declarations sees only the
 * positions an author happened to write on: of the positions this one
 * registers, a third carry no block, and one of those cannot carry one at all.
 * Orphaning any of them left the whole repository green. Driving the collector
 * the way `documentedHosts` does gives the case both sets and lets it assert
 * what it is named for, so the next declaration form fails here instead of in a
 * consumer.
 *
 *  1. Collect one file holding every declaration form that registers a host.
 *  2. Take the host map and the unit-to-node index the collector filled.
 *  3. Assert no key of the host map is missing from the index.
 */
func TestEveryHostPositionBelongsToAUnit(t *testing.T) {
  file := parseTestSourceFile(t, "src/contracts.ts", hostPositionCorpus)
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
  recorded := map[*shimast.Node]bool{}
  for _, nodes := range inventory.UnitNodes {
    for _, node := range nodes {
      recorded[node] = true
    }
  }
  orphans := []string{}
  for node, hosts := range supported {
    if recorded[node] {
      continue
    }
    orphans = append(
      orphans,
      node.Kind.String()+" hosting "+hosts.names()+
        " at line "+decimal(lineAtNode("src/contracts.ts", node)),
    )
  }
  sort.Strings(orphans)
  if len(orphans) != 0 {
    t.Fatalf(
      "these host positions belong to no unit:\n%s",
      strings.Join(orphans, "\n"),
    )
  }
}
