package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies class materialization: the class is a type unit and every public
 * member is a unit of its own kind.
 *
 * The class is the subject an obligation belongs to, its methods are what the
 * subject does, and its member variables are the measured facts it carries. The
 * unexported members and the nameless ones are the negative twins: each is a
 * member the loop reaches and must decline for a different reason, so an
 * over-broad filter cannot hide behind the positives.
 *
 *  1. Declare public and non-public members of every class member shape.
 *  2. Collect the inventory.
 *  3. Assert the exact unit set with its symbol kinds.
 *
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises the authored fixture. Assert the exact unit set with its symbol kinds.
 * @evidence contracts/testing.md#independent-expectations The class is the subject an obligation belongs to, its methods are what the subject does, and its member variables are the measured facts it carries. The unexported members and the nameless ones are the negative twins: each is a member the loop reaches and must decline for a different reason, so an over-broad filter cannot hide behind the positives. The authored scenario requires this outcome: Assert the exact unit set with its symbol kinds.
 * @evidence contracts/testing.md#distinguishing-cases Declare public and non-public members of every class member shape. Collect the inventory. Assert the exact unit set with its symbol kinds.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptMaterializesClassContracts runs as a Go unit entry in the native package. parseTypeScriptInventory executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptMaterializesClassContracts(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/Sale.ts", classContractSource)
  units := []string{}
  for _, unit := range inventory.Units {
    units = append(units, unit.Symbol+":"+unit.Target)
  }
  sort.Strings(units)
  want := []string{
    "function:Sale.create",
    "function:Sale.prototype.charge",
    "property:Sale.currency",
    "property:Sale.prototype.price",
    "type:Sale",
  }
  if strings.Join(units, "\n") != strings.Join(want, "\n") {
    t.Fatalf(
      "class units:\n%s\nwant:\n%s",
      strings.Join(units, "\n"),
      strings.Join(want, "\n"),
    )
  }
}
