package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies graph reports declaration failures.
 *
 * Four invalid tag/host relations coexist with a valid first citation; all original cause-specific and scope repair assertions remain active.
 *
 * 1. graphRule.Check distinguishes a missing reason, absent target, evidence/exclusion conflict and an out-of-scope interface host.
 * 2. Independently spelled required/absent targets and malformed/conflict/out-of-scope diagnostic fragments specify separate failures and their claim/reference context.
 *
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check distinguishes a missing reason, absent target, evidence/exclusion conflict and an out-of-scope interface host.
 * @evidence contracts/testing.md#independent-expectations Independently spelled required/absent targets and malformed/conflict/out-of-scope diagnostic fragments specify separate failures and their claim/reference context.
 * @evidence contracts/testing.md#distinguishing-cases Four invalid tag/host relations coexist with a valid first citation; all original cause-specific and scope repair assertions remain active.
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticGraphReportsDeclarationFailures owns these assertions. runIndexRule parses every declaration in citations.ts and calls graphRule.Check once; this test owns the complete multi-cause diagnostic population.
 */
func TestEvidenceSemanticGraphReportsDeclarationFailures(t *testing.T) {
  files := map[string]string{
    "docs/spec.md":     "## Required {#required}\n",
    "src/citations.ts": "/** @evidence docs/spec.md#required */\nexport function missingReason(): void {}\n\n/** @evidence docs/spec.md#absent This target does not exist. */\nexport function unresolved(): void {}\n\n/** @evidence docs/spec.md#required First acknowledgement. */\nexport function first(): void {}\n\n/** @evidenceExclude docs/spec.md#required This contradicts the implementation acknowledgement. */\nexport function second(): void {}\n\n/** @evidence docs/spec.md#required A property is outside the selected function hosts. */\nexport interface IOutside {\n  value: string;\n}\n",
  }
  messages := runIndexRule(t, files, "{\"claims\":[{\"type\":\"typescript\",\"files\":[\"src/citations.ts\"],\"symbol\":\"function\",\"reference\":{\"type\":\"markdown\",\"files\":[\"docs/spec.md\"],\"symbol\":\"h2\"}}]}")
  output := strings.Join(messages, "\n")
  if len(messages) == 0 {
    t.Fatal("the negative fixture produced no finding")
  }
  if !strings.Contains(output, "Malformed @evidence declaration") {
    t.Fatalf("missing %q in %s", "Malformed @evidence declaration", output)
  }
  if !strings.Contains(output, "Unresolved evidence target 'docs/spec.md#absent'") {
    t.Fatalf("missing %q in %s", "Unresolved evidence target 'docs/spec.md#absent'", output)
  }
  if !strings.Contains(output, "Conflicting acknowledgements for 'docs/spec.md#required'") {
    t.Fatalf("missing %q in %s", "Conflicting acknowledgements for 'docs/spec.md#required'", output)
  }
  if !strings.Contains(output, "Out-of-scope @evidence host") {
    t.Fatalf("missing %q in %s", "Out-of-scope @evidence host", output)
  }
  if !strings.Contains(output, "for Claim 1 across reference 1 (markdown, symbols: h2)") {
    t.Fatalf("missing %q in %s", "for Claim 1 across reference 1 (markdown, symbols: h2)", output)
  }
  if !strings.Contains(output, "target 'docs/spec.md#required'") {
    t.Fatalf("missing %q in %s", "target 'docs/spec.md#required'", output)
  }
}
