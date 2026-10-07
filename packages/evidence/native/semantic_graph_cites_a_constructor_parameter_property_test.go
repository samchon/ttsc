package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies graph cites a constructor parameter property.
 *
 * Public parameter property and normal field citations cover Price/Currency; the uncited heading proves the graph is active. The private ledger is incidental here: these assertions do not independently prove its filtering.
 *
 * 1. graphRule.Check accepts price evidence on a public constructor parameter property and currency evidence on an ordinary field, leaving only uncited.
 * 2. The explicit Price/Currency/Uncited headings define three obligations, and exactly one diagnostic must name uncited while price/currency stay absent from findings.
 *
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check accepts price evidence on a public constructor parameter property and currency evidence on an ordinary field, leaving only uncited.
 * @evidence contracts/testing.md#independent-expectations The explicit Price/Currency/Uncited headings define three obligations, and exactly one diagnostic must name uncited while price/currency stay absent from findings.
 * @evidence contracts/testing.md#distinguishing-cases Public parameter property and normal field citations cover Price/Currency; the uncited heading proves the graph is active. The private ledger is incidental here: these assertions do not independently prove its filtering.
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticGraphCitesAConstructorParameterProperty owns these assertions. runIndexRule parses Sale.ts and loads the temporary fields document before invoking graphRule.Check in the shared Go process.
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
  if len(messages) != 1 {
    t.Fatalf("only the deliberately uncited heading must fail, got %d: %s", len(messages), output)
  }

}
