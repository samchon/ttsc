package evidence

import (
  "testing"
)

/**
 * Verifies the reported declaration is stable across repeated scans.
 *
 * The association between an identity and its declarations lives in maps, and a
 * diagnostic whose line drifts between runs is worse than one that is
 * consistently wrong: it makes a failure irreproducible and a baseline
 * unwritable. Repetition is the only way to catch an ordering that happens to
 * be stable in one run.
 *
 *  1. Scan the same merged identity forty times.
 *  2. Collect every line the unit reported.
 *  3. Assert exactly one line was ever produced.
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory is called forty times on an interface merged with a same-named namespace, and the set of lines reported for the unit targeted ISale must contain exactly one value, line 2.
 * @evidence contracts/testing.md#independent-expectations The literal line 2 is read off the authored fixture, where the interface is the first declaration after the leading newline; the expectation is the stated first-declaration line, not a value taken from a previous run of the implementation.
 * @evidence contracts/testing.md#distinguishing-cases A repetition case: forty independent scans of one merged-identity fixture detect a map-iteration-order dependence that a single scan could miss. It runs one fixture only, so merge order and non-merged identities are owned by sibling tests.
 * @evidence contracts/testing.md#execution-ownership TestMergedIdentityLineIsStableAcrossScans runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestMergedIdentityLineIsStableAcrossScans(t *testing.T) {
  source := `
export interface ISale {
  price: number;
}
export namespace ISale {
  export interface ICreate {
    price: number;
  }
}
`
  lines := map[int]bool{}
  for attempt := 0; attempt < 40; attempt++ {
    inventory := parseTypeScriptInventory(t, "src/ISale.ts", source)
    for _, unit := range inventory.Units {
      if unit.Target == "ISale" {
        lines[unit.Line] = true
      }
    }
  }
  if len(lines) != 1 || !lines[2] {
    t.Fatalf("a merged identity's reported line must be stable at 2, got %v", lines)
  }
}
