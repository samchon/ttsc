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
 * @evidence contracts/testing.md#behavioral-verification runDocumentedRule runs the documented rule with default options over an undocumented `export class Service {}` and an undocumented `export enum Mode`; assertReported requires exactly one diagnostic, `Missing JSDoc on exported type 'Service'`.
 * @evidence contracts/testing.md#independent-expectations The expected report is authored from the population contract: a class is a type unit the graph can select as a claim host and an enum is not, so only the class may be demanded.
 * @evidence contracts/testing.md#distinguishing-cases The class (reported) beside the enum (ignored) separates a rule that selects the claim-host population from one that demands a block on every declaration.
 * @evidence contracts/testing.md#execution-ownership TestDocumentedSelectsAClassAndIgnoresAnEnum is a Go unit entry in the native test process; runDocumentedRule parses the source with the TypeScript parser and calls the documented rule directly, with no consumer install or product host.
 */
func TestDocumentedSelectsAClassAndIgnoresAnEnum(t *testing.T) {
  assertReported(t, runDocumentedRule(t, "src/Service.ts", `
export class Service {}
export enum Mode {
  Fast = "fast",
}
`, ""), "Missing JSDoc on exported type 'Service'")
}
