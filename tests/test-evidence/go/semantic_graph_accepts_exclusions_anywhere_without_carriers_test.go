package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies graph accepts exclusions anywhere without carriers.
 *
 * The original unrestricted exclusion must be silent while the same population without that tag must fail; declared-carrier variants are separate tests.
 *
 * 1. graphRule.Check accepts a deferOperation exclusion when no carrier restriction is declared, and removing it exposes deferred.
 * 2. Implemented/deferred literal headings and their explicit citation/exclusion establish the contract; the removal control independently expects Missing acknowledgement for deferred.
 *
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check accepts a deferOperation exclusion when no carrier restriction is declared, and removing it exposes deferred.
 * @evidence contracts/testing.md#independent-expectations Implemented/deferred literal headings and their explicit citation/exclusion establish the contract; the removal control independently expects Missing acknowledgement for deferred.
 * @evidence contracts/testing.md#distinguishing-cases The original unrestricted exclusion must be silent while the same population without that tag must fail; declared-carrier variants are separate tests.
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticGraphAcceptsExclusionsAnywhereWithoutCarriers owns these assertions. runIndexRule materializes temporary Markdown/TypeScript fixtures and calls graphRule.Check directly for both preserved and removal-control populations.
 */
func TestEvidenceSemanticGraphAcceptsExclusionsAnywhereWithoutCarriers(t *testing.T) {
  files := map[string]string{
    "docs/spec.md":   "## Implemented {#implemented}\n\n## Deferred {#deferred}\n",
    "src/LEDGER.ts":  "/** Central exclusions for this package. */\nexport const LEDGER = true;\n",
    "src/service.ts": "/** @evidence docs/spec.md#implemented Implements the section. */\nexport function implement(): void {}\n\n/** @evidenceExclude docs/spec.md#deferred No carrier is declared, so any host may hold this. */\nexport function deferOperation(): void {}\n",
  }
  messages := runIndexRule(t, files, "{\"claims\":[{\"name\":\"operations\",\"type\":\"typescript\",\"files\":[\"src/**/*.ts\"],\"symbol\":\"function\",\"reference\":{\"type\":\"markdown\",\"files\":[\"docs/spec.md\"],\"symbol\":\"h2\"}}]}")
  output := strings.Join(messages, "\n")
  if len(messages) != 0 {
    t.Fatalf("unexpected findings: %s", output)
  }
  if strings.Contains(output, "Misplaced @evidenceExclude") {
    t.Fatalf("unexpected %q in %s", "Misplaced @evidenceExclude", output)
  }
  if strings.Contains(output, "Missing acknowledgement") {
    t.Fatalf("unexpected %q in %s", "Missing acknowledgement", output)
  }
  withoutExclusion := make(map[string]string, len(files))
  for name, content := range files {
    withoutExclusion[name] = content
  }
  withoutExclusion["src/service.ts"] = strings.Replace(files["src/service.ts"], "/** @evidenceExclude docs/spec.md#deferred No carrier is declared, so any host may hold this. */\n", "", 1)
  rejected := strings.Join(runIndexRule(t, withoutExclusion, "{\"claims\":[{\"name\":\"operations\",\"type\":\"typescript\",\"files\":[\"src/**/*.ts\"],\"symbol\":\"function\",\"reference\":{\"type\":\"markdown\",\"files\":[\"docs/spec.md\"],\"symbol\":\"h2\"}}]}"), "\n")
  if !strings.Contains(rejected, "Missing acknowledgement for 'docs/spec.md#deferred'") {
    t.Fatalf("removing only the accepted exclusion must expose its obligation: %s", rejected)
  }

}
