package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies a static member's withdrawal leaves an instance member of the same
 * name alone.
 *
 * Withdrawal follows the unit identity, and an instance member and a static
 * member of one name are two identities with two addresses. Resolving it by the
 * bare name would let `@internal` on one silently withdraw the other, which is
 * a public declaration leaving the population with nothing said about it.
 *
 *  1. Withdraw a static member beside an instance member of the same name.
 *  2. Collect the inventory.
 *  3. Assert only the static identity carries the tag.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert only the static identity carries the tag.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Withdrawal follows the unit identity, and an instance member and a static member of one name are two identities with two addresses. Resolving it by the bare name would let `@internal` on one silently withdraw the other, which is a public declaration leaving the population with nothing said about it. The authored scenario requires this outcome: Assert only the static identity carries the tag.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Withdraw a static member beside an instance member of the same name. Collect the inventory. Assert only the static identity carries the tag.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestWithdrawalIsKeyedOnTheMemberIdentity runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestWithdrawalIsKeyedOnTheMemberIdentity(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/Sale.ts", `
export class Sale {
  /**
   * @internal
   */
  static parse(value: string): void {}
  parse(value: string): void {}
}
`)
  tagged := []string{}
  for _, unit := range inventory.Units {
    tagged = append(tagged, unit.Symbol+":"+unit.Target+"="+unit.Hidden)
  }
  sort.Strings(tagged)
  want := []string{
    "function:Sale.parse=@internal",
    "function:Sale.prototype.parse=",
    "type:Sale=",
  }
  if strings.Join(tagged, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "same-named member withdrawal:\n%s\nwant:\n%s",
      strings.Join(tagged, "\n"),
      strings.Join(want, "\n"),
    )
  }
}
