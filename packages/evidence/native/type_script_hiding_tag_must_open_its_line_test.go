package evidence

import (
  "testing"
)

/**
 * Verifies the tag has to open its own line.
 *
 * Prose describing something as internal is not a declaration that it is, and
 * a substring match would let a sentence delete an obligation nobody meant to
 * withdraw. The positive twin one line away is what keeps this from passing on
 * a collector that ignores the tag entirely.
 *
 *  1. Mention the tag mid-sentence on one declaration and write it as a tag on
 *     another.
 *  2. Collect the inventory.
 *  3. Assert only the tagged declaration is withdrawn.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert only the tagged declaration is withdrawn.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Prose describing something as internal is not a declaration that it is, and a substring match would let a sentence delete an obligation nobody meant to withdraw. The positive twin one line away is what keeps this from passing on a collector that ignores the tag entirely. The authored scenario requires this outcome: Assert only the tagged declaration is withdrawn.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Mention the tag mid-sentence on one declaration and write it as a tag on another. Collect the inventory. Assert only the tagged declaration is withdrawn.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestTypeScriptHidingTagMustOpenItsLine runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptHidingTagMustOpenItsLine(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/contracts.ts", `
/** Superseded by the @internal registry, which this still mirrors. */
export interface IMentioned {
  id: string;
}

/** @internal Not part of the published surface. */
export interface ITagged {
  id: string;
}
`)
  hidden := map[string]string{}
  for _, unit := range inventory.Units {
    hidden[unit.Target] = unit.Hidden
  }
  if hidden["IMentioned"] != "" {
    t.Fatalf("prose mention withdrew the declaration as %q", hidden["IMentioned"])
  }
  if hidden["ITagged"] != "@internal" {
    t.Fatalf("expected the tagged declaration to be withdrawn, got %q", hidden["ITagged"])
  }
}
