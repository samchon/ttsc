package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies accessor classification: neither a callable nor a data accessor
 * becomes an evidence unit.
 *
 * Auto-accessors share PropertyDeclaration shape with ordinary fields but
 * retain accessor semantics, and a get/set pair is not a member variable
 * either. The ordinary field and method in the same class are the positive
 * controls: without them a collector that had stopped materializing class
 * members entirely would pass this case.
 *
 * An interface accessor is here because the rule has to hold wherever a member
 * is classified, and the interface collector reaches its member kinds through a
 * different switch. Adding a get/set case to that switch is a one-line edit and
 * it left the whole suite green, so the exclusion was stated for a class and
 * merely assumed for an interface.
 *
 *  1. Declare ordinary members beside callable and data accessors, on a class
 *     and on an interface.
 *  2. Collect the inventory.
 *  3. Assert only the ordinary members materialize.
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert only the ordinary members materialize.
 * @evidence contracts/testing.md#independent-expectations Auto-accessors share PropertyDeclaration shape with ordinary fields but retain accessor semantics, and a get/set pair is not a member variable either. The ordinary field and method in the same class are the positive controls: without them a collector that had stopped materializing class members entirely would pass this case. The authored scenario requires this outcome: Assert only the ordinary members materialize.
 * @evidence contracts/testing.md#distinguishing-cases Declare ordinary members beside callable and data accessors, on a class and on an interface. Collect the inventory. Assert only the ordinary members materialize.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptAccessorsAreNotEvidenceUnits runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptAccessorsAreNotEvidenceUnits(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/contracts.ts", `
export class Service {
  handler = (): void => {};
  static factory: () => void;
  retries: number = 3;
  accessor callback = (): void => {};
  static accessor provider: () => void;
  accessor count = 0;
  static accessor limit: number;
  get computed(): number {
    return 1;
  }
  set computed(value: number) {}
}
export interface IService {
  handler: () => void;
  send(): void;
  retries: number;
  get computed(): number;
  set computed(value: number);
}
`)
  targets := []string{}
  for _, unit := range inventory.Units {
    targets = append(targets, unit.Symbol+":"+unit.Target)
  }
  sort.Strings(targets)
  want := []string{
    "function:IService.handler",
    "function:IService.send",
    "function:Service.factory",
    "function:Service.prototype.handler",
    "property:IService.retries",
    "property:Service.prototype.retries",
    "type:IService",
    "type:Service",
  }
  if strings.Join(targets, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "accessor units:\n%s\nwant:\n%s",
      strings.Join(targets, "\n"),
      strings.Join(want, "\n"),
    )
  }
}
