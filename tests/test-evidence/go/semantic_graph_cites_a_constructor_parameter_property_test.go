package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies graph cites a constructor parameter property.
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
func TestEvidenceSemanticGraphCitesAConstructorParameterProperty(t *testing.T) {
  files := map[string]string{
    "docs/fields.md": "## Price {#price}\n\nThe amount the customer pays.\n\n## Currency {#currency}\n\nThe currency the price is quoted in.\n\n## Uncited {#uncited}\n\nNothing answers for this section.\n",
    "src/Sale.ts":    "export class Sale {\n  /** @evidence docs/fields.md#currency The currency this section fixes. */\n  public readonly currency: string = \"KRW\";\n  public constructor(\n    /** @evidence docs/fields.md#price The price this section fixes. */\n    public readonly price: number,\n    private readonly ledger: number,\n  ) {}\n}\n",
  }
  messages := runIndexRule(t, files, "{\"claims\":[{\"type\":\"typescript\",\"files\":[\"src/Sale.ts\"],\"symbol\":\"property\",\"reference\":{\"type\":\"markdown\",\"files\":[\"docs/fields.md\"],\"symbol\":\"h2\"}}]}")
  output := strings.Join(messages, "\n")
  if len(messages) == 0 {
    t.Fatal("the negative fixture produced no finding")
  }
  if !strings.Contains(output, "Missing acknowledgement for 'docs/fields.md#uncited'") {
    t.Fatalf("missing %q in %s", "Missing acknowledgement for 'docs/fields.md#uncited'", output)
  }
  if strings.Contains(output, "docs/fields.md#price") {
    t.Fatalf("unexpected %q in %s", "docs/fields.md#price", output)
  }
  if strings.Contains(output, "docs/fields.md#currency") {
    t.Fatalf("unexpected %q in %s", "docs/fields.md#currency", output)
  }
}
