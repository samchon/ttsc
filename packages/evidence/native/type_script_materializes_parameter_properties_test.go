package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies a constructor parameter property is the field it declares.
 *
 * `constructor(public readonly price: number)` declares the same public
 * instance field as `readonly price: number` in the class body, so the two
 * syntaxes must materialize the same unit. The ordinary parameter beside it is
 * the negative twin that keeps the modifier check falsifiable: without it, a
 * collector that had started selecting every constructor parameter would look
 * identical here.
 *
 * The modifier axis is enumerated rather than sampled. TypeScript's
 * `ParameterPropertyModifier` mask holds five modifiers, and `override` is the
 * one a list written from memory drops, because its own meaning is about the
 * base class rather than about the field. It still declares one, so the base
 * class is here to make the row real rather than to decorate it.
 *
 *  1. Declare public, readonly, override, modifier-less, private, and
 *     protected constructor parameters beside a body field.
 *  2. Collect the inventory.
 *  3. Assert only the public parameter properties join the body field.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert only the public parameter properties join the body field.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations `constructor(public readonly price: number)` declares the same public instance field as `readonly price: number` in the class body, so the two syntaxes must materialize the same unit. The ordinary parameter beside it is the negative twin that keeps the modifier check falsifiable: without it, a collector that had started selecting every constructor parameter would look identical here. The authored scenario requires this outcome: Assert only the public parameter properties join the body field.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Declare public, readonly, override, modifier-less, private, and protected constructor parameters beside a body field. Collect the inventory. Assert only the public parameter properties join the body field.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestTypeScriptMaterializesParameterProperties runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptMaterializesParameterProperties(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/Sale.ts", `
class Base {
  rate: number = 0;
}
export class Sale extends Base {
  readonly declared: number = 0;
  constructor(
    public readonly price: number,
    readonly currency: string,
    override rate: number,
    plain: number,
    private ledger: number,
    protected audit: number,
  ) {
    super();
  }
}
`)
  units := []string{}
  for _, unit := range inventory.Units {
    units = append(units, unit.Symbol+":"+unit.Target)
  }
  sort.Strings(units)
  want := []string{
    "property:Sale.prototype.currency",
    "property:Sale.prototype.declared",
    "property:Sale.prototype.price",
    "property:Sale.prototype.rate",
    "type:Sale",
  }
  if strings.Join(units, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "parameter property units:\n%s\nwant:\n%s",
      strings.Join(units, "\n"),
      strings.Join(want, "\n"),
    )
  }
}
