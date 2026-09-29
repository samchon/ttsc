package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies graph cites an interface callable.
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
func TestEvidenceSemanticGraphCitesAnInterfaceCallable(t *testing.T) {
  files := map[string]string{
    "docs/behaviour.md": "## Charge {#charge}\n\nHow the amount is taken.\n\n## Settle {#settle}\n\nHow the transaction closes.\n\n## Uncited {#uncited}\n\nNothing answers for this section.\n",
    "src/ISale.ts":      "export interface ISale {\n  /** @evidence docs/behaviour.md#charge The behaviour this section fixes. */\n  charge: () => void;\n  /** @evidence docs/behaviour.md#settle The behaviour this section fixes. */\n  settle(): void;\n  price: number;\n}\n",
  }
  messages := runIndexRule(t, files, "{\"claims\":[{\"type\":\"typescript\",\"files\":[\"src/ISale.ts\"],\"symbol\":\"function\",\"reference\":{\"type\":\"markdown\",\"files\":[\"docs/behaviour.md\"],\"symbol\":\"h2\"}}]}")
  output := strings.Join(messages, "\n")
  if len(messages) == 0 {
    t.Fatal("the negative fixture produced no finding")
  }
  if !strings.Contains(output, "Missing acknowledgement for 'docs/behaviour.md#uncited'") {
    t.Fatalf("missing %q in %s", "Missing acknowledgement for 'docs/behaviour.md#uncited'", output)
  }
  if strings.Contains(output, "docs/behaviour.md#charge") {
    t.Fatalf("unexpected %q in %s", "docs/behaviour.md#charge", output)
  }
  if strings.Contains(output, "docs/behaviour.md#settle") {
    t.Fatalf("unexpected %q in %s", "docs/behaviour.md#settle", output)
  }
}
