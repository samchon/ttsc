package evidence

import (
  "testing"
)

/**
 * Verifies a generated accessor resolves to exactly one unit and owes exactly
 * one acknowledgement.
 *
 * The members were not merely noisy: selecting them promoted the merged
 * namespace to an addressable aggregate scope, where it collided with the
 * function unit of the same name and left every `{@link ...}` citation of the
 * accessor ambiguous. So there was no spelling of the target that resolved, and
 * the citing host was reported as citing zero units under
 * `singleEvidencePerSymbol`. Resolution and cardinality are asserted together
 * because the second was a consequence of the first.
 *
 *  1. Publish the accessor through the nested barrels an SDK generates.
 *  2. Cite it once from a host under `singleEvidencePerSymbol`.
 *  3. Assert silence, which requires one resolution, one obligation, and a
 *     count of exactly one.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a function claim over test/** and a function reference over src/index.ts with `singleEvidencePerSymbol`, over the merged-accessor fixture (nested barrels for a generated SDK) and a host citing `{@link api.functional.health.get}` once; assertNoProblems requires an empty list.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the unit-model contract: a function-merged accessor is exactly one unit, so one citation resolves, one obligation exists and the host counts as citing exactly one unit under singleEvidencePerSymbol; the namespace members must not promote an ambiguous aggregate scope.
 * @evidence contracts/testing.md#distinguishing-cases Resolution and cardinality are asserted together through one silent run; the companion that the accessor itself is still owed when uncited is TestGraphStillOwesTheFunctionMergedAccessorItself.
 * @evidence contracts/testing.md#execution-ownership TestGraphResolvesAFunctionMergedAccessorToOneUnit is a Go unit entry in the native test process; runIndexRule writes the fixtures to a temp directory and calls the graph rule directly, with no consumer install or product host.
 */
func TestGraphResolvesAFunctionMergedAccessorToOneUnit(t *testing.T) {
  files := mergedAccessorFiles()
  files["test/health.ts"] = `import type * as api from "../src/index";

/** @evidence {@link api.functional.health.get} Exercises the health operation. */
export function test_health(): void {}
`
  assertNoProblems(t, runIndexRule(t, files, `{"claims":[{
    "type":"typescript",
    "files":["test/**"],
    "symbol":"function",
    "reference":{
      "type":"typescript",
      "files":["src/index.ts"],
      "symbol":["function"],
      "singleEvidencePerSymbol":true
    }
  }]}`))
}
