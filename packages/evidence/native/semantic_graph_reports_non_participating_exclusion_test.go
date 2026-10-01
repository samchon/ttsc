package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies graph reports non participating exclusion.
 *
 * A valid Second citation cannot legalize the foreign exclusion in First; independent-claim coverage and eligible-carrier placement have separate cases.
 *
 * 1. An exclusion in First naming only the second claim reference is rejected as non-participating for Claim 1.
 * 2. Literal first/second reference documents and claim populations independently establish ownership; the message must pair docs/second.md#second with Claim 1 first.
 *
 * @evidence contracts/testing.md#behavioral-verification An exclusion in First naming only the second claim reference is rejected as non-participating for Claim 1.
 * @evidence contracts/testing.md#independent-expectations Literal first/second reference documents and claim populations independently establish ownership; the output must contain the non-participating message for target docs/second.md#second and, separately, the context text "Claim 1 ('first') across reference 1"; the two substrings are checked independently over the joined output, not within one message.
 * @evidence contracts/testing.md#distinguishing-cases A valid Second citation cannot legalize the foreign exclusion in First; independent-claim coverage and eligible-carrier placement have separate cases.
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticGraphReportsNonParticipatingExclusion owns these assertions. runIndexRule invokes graphRule.Check once for both typed claims and their temporary Markdown documents.
 */
func TestEvidenceSemanticGraphReportsNonParticipatingExclusion(t *testing.T) {
  files := map[string]string{
    "docs/first.md":  "## First\n",
    "docs/second.md": "## Second\n",
    "src/first.ts":   "/** @evidenceExclude docs/second.md#second This exclusion belongs to no reference of this claim. */\nexport interface First {}\n",
    "src/second.ts":  "/** @evidence docs/second.md#second This claim owns the target. */\nexport interface Second {}\n",
  }
  messages := runIndexRule(t, files, "{\"claims\":[{\"name\":\"first\",\"type\":\"typescript\",\"files\":[\"src/first.ts\"],\"symbol\":\"type\",\"reference\":{\"type\":\"markdown\",\"files\":[\"docs/first.md\"],\"symbol\":\"h2\"}},{\"name\":\"second\",\"type\":\"typescript\",\"files\":[\"src/second.ts\"],\"symbol\":\"type\",\"reference\":{\"type\":\"markdown\",\"files\":[\"docs/second.md\"],\"symbol\":\"h2\"}}]}")
  output := strings.Join(messages, "\n")
  if len(messages) == 0 {
    t.Fatal("the negative fixture produced no finding")
  }
  if !strings.Contains(output, "Non-participating @evidenceExclude target 'docs/second.md#second'") {
    t.Fatalf("missing %q in %s", "Non-participating @evidenceExclude target 'docs/second.md#second'", output)
  }
  if !strings.Contains(output, "Claim 1 ('first') across reference 1") {
    t.Fatalf("missing %q in %s", "Claim 1 ('first') across reference 1", output)
  }
}
