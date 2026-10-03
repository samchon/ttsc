package evidence

import (
  "testing"
)

/**
 * Verifies one allowed reference keeps a target in the global exclusion corpus.
 *
 * Identical references are independent obligations, and the cursorless hint API cannot know which one the author is editing. A target legal under any enabled reference must therefore remain offered even when a strict twin selects the same graph identity.
 *
 *  1. Select one section through strict and ordinary references.
 *  2. Satisfy both with one positive citation.
 *  3. Assert the shared target remains an exclusion hint.
 *
 * @evidence contracts/testing.md#behavioral-verification runGraphHints keeps docs/spec.md#contract in exclusion hints when strict and ordinary references select the same section.
 * @evidence contracts/testing.md#independent-expectations The cursorless corpus is the union of targets legal under any enabled reference; an ordinary reference independently permits the target even when another forbids exclusion.
 * @evidence contracts/testing.md#distinguishing-cases Two references to the same authored H2 differ only in noEvidenceExclude and share one positive citation. This is the permissive twin of the strict-only exclusion test.
 * @evidence contracts/testing.md#execution-ownership TestHintsKeepTargetsAllowedByAnyReference is the Go unit entry discovered beside the native package. Its runGraphHints fixture executes Check and the simulated passing gate before Hints in the same process; it does not launch an editor, LSP host or native artifact.
 */
func TestHintsKeepTargetsAllowedByAnyReference(t *testing.T) {
  hints, messages := runGraphHints(t, map[string]string{
    "docs/spec.md": "## Contract {#contract}\n",
    "src/test.ts": `/** @evidence docs/spec.md#contract Implements the contract. */
export function testContract(): void {}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "symbol":"function",
    "reference":[
      {
        "type":"markdown",
        "files":["docs/spec.md"],
        "symbol":"h2",
        "noEvidenceExclude":true
      },
      {
        "type":"markdown",
        "files":["docs/spec.md"],
        "symbol":"h2"
      }
    ]
  }]}`)
  assertSilent(t, messages)
  exclusion := targetInserts(targetHintsAt(hints, "@evidenceExclude "))
  if !contains(exclusion, "docs/spec.md#contract") {
    t.Fatalf("allowed twin did not preserve the exclusion hint: %v", exclusion)
  }
}
