package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies graph reports an exclusion outside its carrier.
 *
 * Implemented is properly cited, LEDGER is allowed but untagged, and deferOperation holds the forbidden exclusion; accepted carrier placement is covered separately.
 *
 * 1. graphRule.Check rejects deferOperation as an undeclared exclusion carrier and retains the missing deferred obligation.
 * 2. Literal LEDGER-only carrier configuration and named misplaced/deferred diagnostics independently require that a refused tag cannot discharge coverage.
 *
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check rejects deferOperation as an undeclared exclusion carrier and retains the missing deferred obligation.
 * @evidence contracts/testing.md#independent-expectations Literal LEDGER-only carrier configuration and named misplaced/deferred diagnostics independently require that a refused tag cannot discharge coverage.
 * @evidence contracts/testing.md#distinguishing-cases Implemented is properly cited, LEDGER is allowed but untagged, and deferOperation holds the forbidden exclusion; accepted carrier placement is covered separately.
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticGraphReportsAnExclusionOutsideItsCarrier owns these assertions. runIndexRule calls graphRule.Check on the preserved carrier/service/document population directly in the semantic test process.
 */
func TestEvidenceSemanticGraphReportsAnExclusionOutsideItsCarrier(t *testing.T) {
  files := map[string]string{
    "docs/spec.md":   "## Implemented {#implemented}\n\n## Deferred {#deferred}\n",
    "src/LEDGER.ts":  "/** Central exclusions for this package. */\nexport const LEDGER = true;\n",
    "src/service.ts": "/** @evidence docs/spec.md#implemented Implements the section. */\nexport function implement(): void {}\n\n/** @evidenceExclude docs/spec.md#deferred This working host is not a declared carrier. */\nexport function deferOperation(): void {}\n",
  }
  messages := runIndexRule(t, files, "{\"claims\":[{\"name\":\"operations\",\"type\":\"typescript\",\"files\":[\"src/**/*.ts\"],\"symbol\":\"function\",\"evidenceExcludeCarriers\":[\"src/LEDGER.ts\"],\"reference\":{\"type\":\"markdown\",\"files\":[\"docs/spec.md\"],\"symbol\":\"h2\"}}]}")
  output := strings.Join(messages, "\n")
  if len(messages) == 0 {
    t.Fatal("the negative fixture produced no finding")
  }
  if !strings.Contains(output, "Misplaced @evidenceExclude") {
    t.Fatalf("missing %q in %s", "Misplaced @evidenceExclude", output)
  }
  if !strings.Contains(output, "evidenceExcludeCarriers") {
    t.Fatalf("missing %q in %s", "evidenceExcludeCarriers", output)
  }
  if !strings.Contains(output, "'src/LEDGER.ts'") {
    t.Fatalf("missing %q in %s", "'src/LEDGER.ts'", output)
  }
  if !strings.Contains(output, "Missing acknowledgement for 'docs/spec.md#deferred'") {
    t.Fatalf("missing %q in %s", "Missing acknowledgement for 'docs/spec.md#deferred'", output)
  }
}
