package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies a type-only alias over a merged class exposes no member from either
 * half.
 *
 * The class half is already suppressed under a type-only alias, because every
 * member address runs through the class value the alias does not expose.
 * Moving the interface half's members onto that same `prototype` address put
 * them back at exactly the address the suppression exists to keep empty, so the
 * guard has to travel with the merge rather than sit on one collector.
 *
 * The guard has two halves and each needs its own row. A merge inside a
 * namespace the file exports type-only travels through the projection flag; a
 * type-only export of the merge itself travels through the target. Keeping only
 * the second left the whole suite green while the namespace shape republished
 * the very member this exists to withhold. The two rows also spell their
 * type-only export differently, `export type { Sale }` against
 * `export { type Space }`, because the flag is set from the declaration or the
 * specifier and a merge asserting only one spelling does not say so.
 *
 * An interface no class merges with sits beside each half as the negative twin,
 * and it is the reason the guard is not simply moved to the interface
 * collector: its members are type-space, they have always projected, and they
 * must keep projecting under either half.
 *
 *  1. Export a class merged with an interface through a type-only alias, and a
 *     second such merge through a type-only namespace projection.
 *  2. Put an interface no class merges with beside each half, one under the
 *     type-only alias and one inside the type-only namespace.
 *  3. Assert both merges expose their names alone while both unmerged
 *     interfaces expose their members.
 *
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert both merges expose their names alone while both unmerged interfaces expose their members.
 * @evidence contracts/testing.md#independent-expectations The class half is already suppressed under a type-only alias, because every member address runs through the class value the alias does not expose. Moving the interface half's members onto that same `prototype` address put them back at exactly the address the suppression exists to keep empty, so the guard has to travel with the merge rather than sit on one collector. The authored scenario requires this outcome: Assert both merges expose their names alone while both unmerged interfaces expose their members.
 * @evidence contracts/testing.md#distinguishing-cases Export a class merged with an interface through a type-only alias, and a second such merge through a type-only namespace projection. Put an interface no class merges with beside each half, one under the type-only alias and one inside the type-only namespace. Assert both merges expose their names alone while both unmerged interfaces expose their members.
 * @evidence contracts/testing.md#execution-ownership TestTypeOnlyAliasOverAMergedClassExposesNoMember runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeOnlyAliasOverAMergedClassExposesNoMember(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/contracts.ts", `
class Sale {
  charge(): void {}
}
interface Sale {
  extra(): void;
  rate: number;
}
export type { Sale };
namespace Space {
  export class Deal {
    charge(): void {}
  }
  export interface Deal {
    rate: number;
  }
  export interface IScoped {
    tally(): void;
  }
}
export { type Space };
export interface IPlain {
  run(): void;
}
export type { IPlain as PlainAlias };
`)
  units := []string{}
  for _, unit := range inventory.Units {
    units = append(units, unit.Symbol+":"+unit.Target)
  }
  sort.Strings(units)
  want := []string{
    "function:IPlain.run",
    "function:PlainAlias.run",
    "function:Space.IScoped.tally",
    "type:IPlain",
    "type:PlainAlias",
    "type:Sale",
    "type:Space",
    "type:Space.Deal",
    "type:Space.IScoped",
  }
  if strings.Join(units, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "type-only merged class projection:\n%s\nwant:\n%s",
      strings.Join(units, "\n"),
      strings.Join(want, "\n"),
    )
  }
}
