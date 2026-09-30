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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert silence, which requires one resolution, one obligation, and a count of exactly one.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations The members were not merely noisy: selecting them promoted the merged namespace to an addressable aggregate scope, where it collided with the function unit of the same name and left every `{@link ...}` citation of the accessor ambiguous. So there was no spelling of the target that resolved, and the citing host was reported as citing zero units under `singleEvidencePerSymbol`. Resolution and cardinality are asserted together because the second was a consequence of the first. The authored scenario requires this outcome: Assert silence, which requires one resolution, one obligation, and a count of exactly one.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Publish the accessor through the nested barrels an SDK generates. Cite it once from a host under `singleEvidencePerSymbol`. Assert silence, which requires one resolution, one obligation, and a count of exactly one.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestGraphResolvesAFunctionMergedAccessorToOneUnit runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
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
