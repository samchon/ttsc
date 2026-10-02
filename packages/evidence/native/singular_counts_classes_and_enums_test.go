package evidence

import (
  "testing"
)

/**
 * Verifies the counting rule covers a declaration the evidence graph does not
 * materialize as a unit at all.
 *
 * An enum is deliberately not a unit for `evidence/graph`, so a rule reusing
 * that classification would let an exported enum share a file with anything.
 * This rule counts public identities, not evidence units, and the class beside
 * the enum is the control: it counts here for the same reason, independently of
 * being a type unit.
 *
 *  1. Export a class and an enum.
 *  2. Run the rule.
 *  3. Assert both count.
 *
 * @evidence contracts/testing.md#behavioral-verification runSingularRule exercises the authored fixture. Assert both count.
 * @evidence contracts/testing.md#independent-expectations An enum is deliberately not a unit for `evidence/graph`, so a rule reusing that classification would let an exported enum share a file with anything. This rule counts public identities, not evidence units, and the class beside the enum is the control: it counts here for the same reason, independently of being a type unit. The authored scenario requires this outcome: Assert both count.
 * @evidence contracts/testing.md#distinguishing-cases Export a class and an enum. Run the rule. Assert both count.
 * @evidence contracts/testing.md#execution-ownership TestSingularCountsClassesAndEnums runs as a Go unit entry in the native package. runSingularRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestSingularCountsClassesAndEnums(t *testing.T) {
  messages := runSingularRule(t, "src/Service.ts", `
export class Service {}
export enum Mode {
  Fast = "fast",
}
`)
  assertReported(t, messages, "'Mode' (line 3)")
}
