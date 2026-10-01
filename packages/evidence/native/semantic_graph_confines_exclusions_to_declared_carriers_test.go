package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies graph confines exclusions to declared carriers.
 *
 * An eligible property carrier outside selected function hosts must work; removing only its tag must fail, and misplaced working-host exclusions are covered separately.
 *
 * 1. graphRule.Check accepts an exclusion on LEDGER even when function hosts are selected, and losing the tag exposes deferred.
 * 2. Literal implemented/deferred obligations, the explicit LEDGER carrier path and Missing acknowledgement removal control specify the oracle.
 *
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check accepts an exclusion on LEDGER even when function hosts are selected, and losing the tag exposes deferred.
 * @evidence contracts/testing.md#independent-expectations Literal implemented/deferred obligations, the explicit LEDGER carrier path and Missing acknowledgement removal control specify the oracle.
 * @evidence contracts/testing.md#distinguishing-cases An eligible property carrier outside selected function hosts must work; removing only its tag must fail, and misplaced working-host exclusions are covered separately.
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticGraphConfinesExclusionsToDeclaredCarriers owns these assertions. runIndexRule calls graphRule.Check over temporary fixtures for the original carrier configuration and copied no-exclusion control.
 */
func TestEvidenceSemanticGraphConfinesExclusionsToDeclaredCarriers(t *testing.T) {
  files := map[string]string{
    "docs/spec.md":   "## Implemented {#implemented}\n\n## Deferred {#deferred}\n",
    "src/LEDGER.ts":  "/**\n * Central exclusions for this package.\n *\n * @evidenceExclude docs/spec.md#deferred This package intentionally implements no operation for the section.\n */\nexport const LEDGER = true;\n",
    "src/service.ts": "/** @evidence docs/spec.md#implemented Implements the section. */\nexport function implement(): void {}\n",
  }
  messages := runIndexRule(t, files, "{\"claims\":[{\"name\":\"operations\",\"type\":\"typescript\",\"files\":[\"src/**/*.ts\"],\"symbol\":\"function\",\"evidenceExcludeCarriers\":[\"src/LEDGER.ts\"],\"reference\":{\"type\":\"markdown\",\"files\":[\"docs/spec.md\"],\"symbol\":\"h2\"}}]}")
  output := strings.Join(messages, "\n")
  if len(messages) != 0 {
    t.Fatalf("unexpected findings: %s", output)
  }
  if strings.Contains(output, "Missing acknowledgement") {
    t.Fatalf("unexpected %q in %s", "Missing acknowledgement", output)
  }
  if strings.Contains(output, "Misplaced @evidenceExclude") {
    t.Fatalf("unexpected %q in %s", "Misplaced @evidenceExclude", output)
  }
  withoutExclusion := make(map[string]string, len(files))
  for name, content := range files {
    withoutExclusion[name] = content
  }
  withoutExclusion["src/LEDGER.ts"] = strings.Replace(files["src/LEDGER.ts"], " * @evidenceExclude docs/spec.md#deferred This package intentionally implements no operation for the section.\n", "", 1)
  rejected := strings.Join(runIndexRule(t, withoutExclusion, "{\"claims\":[{\"name\":\"operations\",\"type\":\"typescript\",\"files\":[\"src/**/*.ts\"],\"symbol\":\"function\",\"evidenceExcludeCarriers\":[\"src/LEDGER.ts\"],\"reference\":{\"type\":\"markdown\",\"files\":[\"docs/spec.md\"],\"symbol\":\"h2\"}}]}"), "\n")
  if !strings.Contains(rejected, "Missing acknowledgement for 'docs/spec.md#deferred'") {
    t.Fatalf("removing only the accepted exclusion must expose its obligation: %s", rejected)
  }

}
