package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies graph reports declaration failures.
 *
 * The unchanged consumer inputs now exercise the production parser, graph
 * rule, population loading and resolver together without spawning a compiler.
 * Package wiring, typed options, severity and watches remain batched consumer
 * contracts. Every original positive and negative diagnostic is retained here.
 *
 * 1. Materialize the original source and document population.
 * 2. Call the actual project rule with the same JSON options.
 * 3. Check the original findings and silent boundaries.
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
