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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert exactly one line was ever produced.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The association between an identity and its declarations lives in maps, and a diagnostic whose line drifts between runs is worse than one that is consistently wrong: it makes a failure irreproducible and a baseline unwritable. Repetition is the only way to catch an ordering that happens to be stable in one run. The authored scenario requires this outcome: Assert exactly one line was ever produced.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Scan the same merged identity forty times. Collect every line the unit reported. Assert exactly one line was ever produced.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestMergedIdentityLineIsStableAcrossScans runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
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
