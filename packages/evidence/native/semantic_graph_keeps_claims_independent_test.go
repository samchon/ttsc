package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies graph keeps claims independent.
 *
 * Disjoint host selections share one reference document; both claim names and their missing targets must pair correctly rather than only occur somewhere in output.
 *
 * 1. Each claim retains its own missing target: team A lacks beta and team B lacks alpha even though the union covers both.
 * 2. Literal per-team citations and a claim-to-target map independently require exactly two findings with the correct association.
 *
 * @evidence contracts/testing.md#behavioral-verification Each claim retains its own missing target: team A lacks beta and team B lacks alpha even though the union covers both.
 * @evidence contracts/testing.md#independent-expectations Literal per-team citations and a claim-to-target map independently require exactly two findings with the correct association.
 * @evidence contracts/testing.md#distinguishing-cases Disjoint host selections share one reference document; both claim names and their missing targets must pair correctly rather than only occur somewhere in output.
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticGraphKeepsClaimsIndependent owns these assertions. runIndexRule calls graphRule.Check once for the two-claim fixture; this test owns both claim-specific diagnostic checks.
 */
func TestEvidenceSemanticGraphKeepsClaimsIndependent(t *testing.T) {
  files := map[string]string{
    "docs/spec.md":  "## Alpha {#alpha}\n\n## Beta {#beta}\n",
    "src/team-a.ts": "/** @evidence docs/spec.md#alpha Team A implements Alpha. */\nexport function alpha(): void {}\n",
    "src/team-b.ts": "/** @evidence docs/spec.md#beta Team B implements Beta. */\nexport function beta(): void {}\n",
  }
  messages := runIndexRule(t, files, "{\"claims\":[{\"type\":\"typescript\",\"files\":[\"src/team-a.ts\"],\"symbol\":\"function\",\"reference\":{\"type\":\"markdown\",\"files\":[\"docs/spec.md\"],\"symbol\":\"h2\"}},{\"type\":\"typescript\",\"files\":[\"src/team-b.ts\"],\"symbol\":\"function\",\"reference\":{\"type\":\"markdown\",\"files\":[\"docs/spec.md\"],\"symbol\":\"h2\"}}]}")
  output := strings.Join(messages, "\n")
  if len(messages) == 0 {
    t.Fatal("the negative fixture produced no finding")
  }
  if !strings.Contains(output, "Missing acknowledgement for 'docs/spec.md#beta'") {
    t.Fatalf("missing %q in %s", "Missing acknowledgement for 'docs/spec.md#beta'", output)
  }
  if !strings.Contains(output, "Missing acknowledgement for 'docs/spec.md#alpha'") {
    t.Fatalf("missing %q in %s", "Missing acknowledgement for 'docs/spec.md#alpha'", output)
  }
  if !strings.Contains(output, "Claim 1") {
    t.Fatalf("missing %q in %s", "Claim 1", output)
  }
  if !strings.Contains(output, "Claim 2") {
    t.Fatalf("missing %q in %s", "Claim 2", output)
  }
  if len(messages) != 2 {
    t.Fatalf("each claim must retain its own one missing target, got %d: %s", len(messages), output)
  }
  for claim, target := range map[string]string{"Claim 1": "docs/spec.md#beta", "Claim 2": "docs/spec.md#alpha"} {
    matched := false
    for _, message := range messages {
      if strings.Contains(message, claim) && strings.Contains(message, target) {
        matched = true
      }
    }
    if !matched {
      t.Fatalf("%s must report its own target %s: %s", claim, target, output)
    }
  }

}
