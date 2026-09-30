package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies graph cites an interface callable.
 *
 * Callable charge field and settle method cover distinct headings; the uncited heading is the active negative control. Noncallable price is incidental: this case does not independently prove its classification.
 *
 * 1. graphRule.Check accepts evidence on both a callable interface field and method signature, leaving only uncited.
 * 2. Charge/Settle/Uncited literal headings define coverage independently; exact one-finding count and named absence checks prevent false callable failures.
 *
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check accepts evidence on both a callable interface field and method signature, leaving only uncited.
 * @evidence contracts/testing.md#independent-expectations Charge/Settle/Uncited literal headings define coverage independently; exact one-finding count and named absence checks prevent false callable failures.
 * @evidence contracts/testing.md#distinguishing-cases Callable charge field and settle method cover distinct headings; the uncited heading is the active negative control. Noncallable price is incidental: this case does not independently prove its classification.
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticGraphCitesAnInterfaceCallable owns these assertions. runIndexRule builds the ISale.ts function-host population and calls graphRule.Check directly with the preserved Markdown reference.
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
  if len(messages) != 1 {
    t.Fatalf("only the deliberately uncited heading must fail, got %d: %s", len(messages), output)
  }

}
