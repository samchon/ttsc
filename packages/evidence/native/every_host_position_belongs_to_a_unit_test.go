package evidence

import (
  "sort"
  "strings"
  "testing"
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
 * This is the invariant behind three separate silent failures, rather than one
 * more shape beside them. `supportedHosts` is keyed by node while every
 * consumer that matters walks from a unit to its declarations, so a position in
 * the first set and in no unit's node list is invisible to all of them: the
 * withdrawal reconciliation cannot take it away, and a citation on it resolves
 * to no semantic identity, so the per-host policies and the review ledger both
 * count it as nothing while the obligation it discharged reports satisfied. The
 * module-scope declarator was the position that had it, and it was found by a
 * citation rather than by reading.
 *
 * Asserting it once over a corpus of every form is what makes the next
 * declaration form fail here rather than in a consumer. A tag is what makes a
 * position observable, so the corpus carries one on each.
 *
 *  1. Cite one section from every declaration form that registers a host.
 *  2. Scan the file.
 *  3. Assert no declaration carries hosts without a semantic identity.
 */
func TestEveryHostPositionBelongsToAUnit(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/contracts.ts", hostPositionCorpus)
  orphans := []string{}
  for _, declaration := range inventory.Declarations {
    if len(declaration.Hosts) == 0 || len(declaration.SemanticHostIDs) != 0 {
      continue
    }
    orphans = append(
      orphans,
      declaration.Reason+" at line "+decimal(declaration.Line),
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
