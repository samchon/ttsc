package evidence

import "testing"

/**
 * Verifies a class declaration is itself required to be documented and an enum
 * is not.
 *
 * A class is a type unit for `evidence/graph` and an enum is not, so exactly
 * one of the two can be selected as a claim host, and this rule guarantees
 * exactly the population a claim can select. The enum is the twin that keeps
 * the boundary falsifiable: without it, a rule that had started demanding a
 * block on every declaration would look identical here.
 *
 *  1. Export an undocumented class with no members, and an undocumented enum.
 *  2. Run the rule with the default selection.
 *  3. Assert the class alone is reported.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runDocumentedRule exercises this case: Verifies a class declaration is itself required to be documented and an enum is not. The original assertions check assert the class alone is reported.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A class is a type unit for `evidence/graph` and an enum is not, so exactly one of the two can be selected as a claim host, and this rule guarantees exactly the population a claim can select. The enum is the twin that keeps the boundary falsifiable: without it, a rule that had started demanding a block on every declaration would look identical here. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Export an undocumented class with no members, and an undocumented enum. Run the rule with the default selection. Assert the class alone is reported. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDocumentedSelectsAClassAndIgnoresAnEnum is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runDocumentedRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDocumentedSelectsAClassAndIgnoresAnEnum(t *testing.T) {
  assertReported(t, runDocumentedRule(t, "src/Service.ts", `
export class Service {}
export enum Mode {
  Fast = "fast",
}
`, ""), "Missing JSDoc on exported type 'Service'")
}
