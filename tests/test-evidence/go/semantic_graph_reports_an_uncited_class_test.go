package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies graph reports an uncited class.
 *
 * The class exists and is documented, distinguishing missing evidence from a missing host or documentation failure; its price field is outside type selection.
 *
 * 1. graphRule.Check reports the Sale reference heading when the selected class has descriptive JSDoc but no evidence citation.
 * 2. Literal docs/subject.md#sale is an independently authored obligation; ordinary prose cannot count as an acknowledgment.
 *
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check reports the Sale reference heading when the selected class has descriptive JSDoc but no evidence citation.
 * @evidence contracts/testing.md#independent-expectations Literal docs/subject.md#sale is an independently authored obligation; ordinary prose cannot count as an acknowledgment.
 * @evidence contracts/testing.md#distinguishing-cases The class exists and is documented, distinguishing missing evidence from a missing host or documentation failure; its price field is outside type selection.
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticGraphReportsAnUncitedClass owns these assertions. runIndexRule parses Sale.ts and calls graphRule.Check with the type-only host selector and h2 Markdown reference.
 */
func TestEvidenceSemanticGraphReportsAnUncitedClass(t *testing.T) {
  files := map[string]string{
    "docs/subject.md": "## Sale {#sale}\n\nA sale offered to a customer.\n",
    "src/Sale.ts":     "/** A sale offered to a customer. */\nexport class Sale {\n  public readonly price: number = 0;\n}\n",
  }
  messages := runIndexRule(t, files, "{\"claims\":[{\"type\":\"typescript\",\"files\":[\"src/Sale.ts\"],\"symbol\":\"type\",\"reference\":{\"type\":\"markdown\",\"files\":[\"docs/subject.md\"],\"symbol\":\"h2\"}}]}")
  output := strings.Join(messages, "\n")
  if len(messages) == 0 {
    t.Fatal("the negative fixture produced no finding")
  }
  if !strings.Contains(output, "Missing acknowledgement for 'docs/subject.md#sale'") {
    t.Fatalf("missing %q in %s", "Missing acknowledgement for 'docs/subject.md#sale'", output)
  }
}
