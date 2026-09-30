package evidence

import (
  "testing"
)

/**
 * Verifies a merged identity reports the declaration encountered first.
 *
 * Every diagnostic that names a line for such an identity names this one, and
 * nothing pins it: `addTypeScriptUnit` creates the unit on the first
 * materialization and returns the existing one afterwards, so the reported line
 * is a consequence of statement order rather than a stated rule. Making a later
 * declaration win would be a one-line change with no failing test, and the
 * whole campaign now assumes the opposite.
 *
 *  1. Spell one identity through two declarations, in both orders.
 *  2. Materialize the inventory.
 *  3. Assert the unit's line is the earlier declaration either way.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert the unit's line is the earlier declaration either way.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Every diagnostic that names a line for such an identity names this one, and nothing pins it: `addTypeScriptUnit` creates the unit on the first materialization and returns the existing one afterwards, so the reported line is a consequence of statement order rather than a stated rule. Making a later declaration win would be a one-line change with no failing test, and the whole campaign now assumes the opposite. The authored scenario requires this outcome: Assert the unit's line is the earlier declaration either way.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Spell one identity through two declarations, in both orders. Materialize the inventory. Assert the unit's line is the earlier declaration either way.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestMergedIdentityReportsItsFirstDeclaration runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestMergedIdentityReportsItsFirstDeclaration(t *testing.T) {
  for name, source := range map[string]string{
    "interface then namespace": `
export interface ISale {
  price: number;
}
export namespace ISale {
  export interface ICreate {
    price: number;
  }
}
`,
    "namespace then interface": `
export namespace ISale {
  export interface ICreate {
    price: number;
  }
}
export interface ISale {
  price: number;
}
`,
    "interface declared twice": `
export interface ISale {
  price: number;
}
export interface ISale {
  discount: number;
}
`,
  } {
    inventory := parseTypeScriptInventory(t, "src/ISale.ts", source)
    found := false
    for _, unit := range inventory.Units {
      if unit.Target != "ISale" {
        continue
      }
      found = true
      if unit.Line != 2 {
        t.Fatalf("%s: merged identity must report its first declaration at line 2, got %d", name, unit.Line)
      }
    }
    if !found {
      t.Fatalf("%s: no unit materialized for the merged identity", name)
    }
  }
}
