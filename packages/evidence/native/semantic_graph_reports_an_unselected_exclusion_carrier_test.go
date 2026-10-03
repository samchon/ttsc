package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies graph reports an unselected exclusion carrier.
 *
 * The implemented obligation is properly cited, so the unselected carrier configuration is the relevant failure rather than missing acknowledgment.
 *
 * 1. graphRule.Check rejects vendor/LEDGER.ts as an exclusion carrier outside the declared src file population.
 * 2. Literal vendor path versus src glob independently establishes configuration invalidity, and the diagnostic must name evidenceExcludeCarriers and that exact path.
 *
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check rejects vendor/LEDGER.ts as an exclusion carrier outside the declared src file population.
 * @evidence contracts/testing.md#independent-expectations Literal vendor path versus src glob independently establishes configuration invalidity, and the diagnostic must name evidenceExcludeCarriers and that exact path.
 * @evidence contracts/testing.md#distinguishing-cases A single negative case: the configured carrier lies outside the claim's src TypeScript files while the one obligation is cited from a selected file. The test asserts only that some finding names evidenceExcludeCarriers and 'vendor/LEDGER.ts'; it has no positive control with a selected carrier and does not assert that no other finding is reported.
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticGraphReportsAnUnselectedExclusionCarrier owns these assertions. runIndexRule calls graphRule.Check with the preserved src service, document and vendor carrier option in process.
 */
func TestEvidenceSemanticGraphReportsAnUnselectedExclusionCarrier(t *testing.T) {
  files := map[string]string{
    "docs/spec.md":   "## Implemented {#implemented}\n",
    "src/service.ts": "/** @evidence docs/spec.md#implemented Implements the section. */\nexport function implement(): void {}\n",
  }
  messages := runIndexRule(t, files, "{\"claims\":[{\"name\":\"operations\",\"type\":\"typescript\",\"files\":[\"src/**/*.ts\"],\"evidenceExcludeCarriers\":[\"vendor/LEDGER.ts\"],\"symbol\":\"function\",\"reference\":{\"type\":\"markdown\",\"files\":[\"docs/spec.md\"],\"symbol\":\"h2\"}}]}")
  output := strings.Join(messages, "\n")
  if len(messages) == 0 {
    t.Fatal("the negative fixture produced no finding")
  }
  if !strings.Contains(output, "evidenceExcludeCarriers") {
    t.Fatalf("missing %q in %s", "evidenceExcludeCarriers", output)
  }
  if !strings.Contains(output, "'vendor/LEDGER.ts'") {
    t.Fatalf("missing %q in %s", "'vendor/LEDGER.ts'", output)
  }
}
