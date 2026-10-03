package evidence

import (
  "testing"
)

/**
 * Verifies completion keeps positive targets while removing strict exclusion targets.
 *
 * The hint API has no cursor or claim context, so it can only publish the union that is legal somewhere. A target selected solely by a forbid-exclusion reference must disappear only from the exclusion trigger and remain available to positive evidence.
 *
 *  1. Satisfy a strict Markdown reference with positive evidence.
 *  2. Read the passing graph's two completion triggers.
 *  3. Assert the target remains positive-only.
 *
 * @evidence contracts/testing.md#behavioral-verification runGraphHints retains docs/spec.md#contract under positive evidence and removes it under the exclusion trigger for a strict-only reference.
 * @evidence contracts/testing.md#independent-expectations noEvidenceExclude prohibits negative declarations without prohibiting positive citations. The literal contract target must therefore differ between the two independently narrowed trigger lists.
 * @evidence contracts/testing.md#distinguishing-cases One satisfied strict Markdown reference tests positive presence and exclusion absence together; TestHintsKeepTargetsAllowedByAnyReference owns a permissive twin.
 * @evidence contracts/testing.md#execution-ownership TestHintsOmitTargetsBelongingOnlyToForbiddenExclusionReferences is the Go unit entry discovered beside the native package. Its runGraphHints fixture executes Check and the simulated passing gate before Hints in the same process; it does not launch an editor, LSP host or native artifact.
 */
func TestHintsOmitTargetsBelongingOnlyToForbiddenExclusionReferences(t *testing.T) {
  hints, messages := runGraphHints(t, map[string]string{
    "docs/spec.md": "## Contract {#contract}\n",
    "src/test.ts": `/** @evidence docs/spec.md#contract Implements the contract. */
export function testContract(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "files":["docs/spec.md"],
      "symbol":"h2",
      "noEvidenceExclude":true
    }
  }]}`)
  assertSilent(t, messages)
  positive := targetInserts(targetHintsAt(hints, "@evidence "))
  exclusion := targetInserts(targetHintsAt(hints, "@evidenceExclude "))
  if !contains(positive, "docs/spec.md#contract") {
    t.Fatalf("strict target disappeared from positive hints: %v", positive)
  }
  if contains(exclusion, "docs/spec.md#contract") {
    t.Fatalf("strict-only target leaked into exclusion hints: %v", exclusion)
  }
}
