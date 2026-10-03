package evidence

import (
  "testing"
)

/**
 * Verifies a class contains its own members.
 *
 * Containment is what lets one citation on the subject acknowledge the members
 * it selected, and it is stored as a parent identity rather than derived from
 * the dotted address, because a literal dot inside a name would otherwise
 * collapse into qualification. Before the class was a unit its members hung
 * from whatever enclosed the class, so this is the property that moved.
 *
 *  1. Materialize the same class.
 *  2. Read each member unit's parent identity.
 *  3. Assert every member points at the class and the class points at nothing.
 *
 * @evidence contracts/testing.md#behavioral-verification parseTypeScriptInventory parses the shared class contract source (class `Sale` with a static field, public field, method and static method plus private, protected, #private, index-signature and static-block members) and the test requires a `Sale` unit with an empty ParentID and units `Sale.currency`, `Sale.prototype.price`, `Sale.prototype.charge` and `Sale.create`, each with ParentID equal to the class unit's ID.
 * @evidence contracts/testing.md#independent-expectations The expected targets and the parent relation are authored from the containment contract: a member is parented to the class unit by identity, not by parsing its dotted address, and a top-level class has no parent.
 * @evidence contracts/testing.md#distinguishing-cases The four public member forms (static field, instance field, method, static method) each assert their parent; the class itself asserts no parent. Exclusion of the private, protected and other member forms is owned by sibling class-contract entries.
 * @evidence contracts/testing.md#execution-ownership TestClassIsTheContainmentScopeOfItsMembers is a Go unit entry in the native test process; parseTypeScriptInventory parses the shared class source with the TypeScript parser and scans its inventory, with no consumer install or product host.
 */
func TestClassIsTheContainmentScopeOfItsMembers(t *testing.T) {
  inventory := parseTypeScriptInventory(t, "src/Sale.ts", classContractSource)
  byTarget := map[string]*evidenceUnit{}
  for _, unit := range inventory.Units {
    byTarget[unit.Target] = unit
  }
  class := byTarget["Sale"]
  if class == nil {
    t.Fatal("the class must materialize a unit to own its members")
  }
  if class.ParentID != "" {
    t.Fatalf("a top-level class has no parent, got %q", class.ParentID)
  }
  for _, target := range []string{
    "Sale.currency",
    "Sale.prototype.price",
    "Sale.prototype.charge",
    "Sale.create",
  } {
    member := byTarget[target]
    if member == nil {
      t.Fatalf("%s must materialize", target)
    }
    if member.ParentID != class.ID {
      t.Fatalf(
        "%s must hang below the class, got parent %q want %q",
        target,
        member.ParentID,
        class.ID,
      )
    }
  }
}
