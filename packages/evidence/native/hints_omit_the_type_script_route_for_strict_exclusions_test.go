package evidence

import (
  "testing"
)

/**
 * Verifies a strict TypeScript reference filters its exclusion route only.
 *
 * TypeScript symbols are completed by the language service after the plugin inserts `{@link `. That route is still a target hint, so offering it at `@evidenceExclude` when every TypeScript reference forbids exclusions would advertise an impossible declaration.
 *
 *  1. Satisfy one strict TypeScript reference through a real imported symbol.
 *  2. Read positive and exclusion completion triggers.
 *  3. Assert only positive evidence receives the inline-link route.
 * @evidence contracts/testing.md#behavioral-verification runGraphHints exposes the {@link opener at the positive trigger and must omit that opener at the exclusion trigger for a strict TypeScript reference.
 * @evidence contracts/testing.md#independent-expectations The inline-link route follows the same noEvidenceExclude contract as concrete Markdown targets. A strict reference still allows a positive citation, so both trigger expectations are independently required.
 * @evidence contracts/testing.md#distinguishing-cases A real parsed imported IContract citation satisfies the TypeScript reference; the unit compares returned hint lists and does not start a language service.
 * @evidence contracts/testing.md#execution-ownership TestHintsOmitTheTypeScriptRouteForStrictExclusions is the Go unit entry discovered beside the native package. Its runGraphHints fixture executes Check and the simulated passing gate before Hints in the same process; it does not launch an editor, LSP host or native artifact.
 */
func TestHintsOmitTheTypeScriptRouteForStrictExclusions(t *testing.T) {
  hints, messages := runGraphHints(t, map[string]string{
    "src/contract.ts": "export interface IContract {}\n",
    "src/test.ts": `import type { IContract } from "./contract";

/** @evidence {@link IContract} Implements the contract. */
export function testContract(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/test.ts"],
    "symbol":"function",
    "reference":{
      "type":"typescript",
      "files":["src/contract.ts"],
      "symbol":"type",
      "noEvidenceExclude":true
    }
  }]}`)
  assertSilent(t, messages)
  positive := targetInserts(targetHintsAt(hints, "@evidence "))
  exclusion := targetInserts(targetHintsAt(hints, "@evidenceExclude "))
  if !contains(positive, "{@link ") {
    t.Fatalf("positive TypeScript route was removed: %v", positive)
  }
  if contains(exclusion, "{@link ") {
    t.Fatalf("strict TypeScript route leaked into exclusion hints: %v", exclusion)
  }
}
