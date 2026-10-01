package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies documented narrows to selected symbols.
 *
 * The same source runs selected and default options, distinguishing a valid type-only filter from a no-op rule or ignored selector.
 *
 * 1. Selecting type hosts accepts documented ISale despite its undocumented price member and total function; default selection must report total.
 * 2. The literal symbol:type JSON and independently authored JSDoc/type/function fixture specify selection; the unrestricted diagnostic names total explicitly.
 *
 * @evidence contracts/testing.md#behavioral-verification Selecting type hosts accepts documented ISale despite its undocumented price member and total function; default selection must report total.
 * @evidence contracts/testing.md#independent-expectations The literal symbol:type JSON and independently authored JSDoc/type/function fixture specify selection; the unrestricted diagnostic names total explicitly.
 * @evidence contracts/testing.md#distinguishing-cases The same source runs selected and default options, distinguishing a valid type-only filter from a no-op rule or ignored selector.
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticDocumentedNarrowsToSelectedSymbols owns these assertions. runDocumentedRule calls documentedRule.Check directly for the original type selector and the adjacent default-selection control.
 */
func TestEvidenceSemanticDocumentedNarrowsToSelectedSymbols(t *testing.T) {
  files := map[string]string{
    "src/ISale.ts": "/** A sale offered to a customer. */\nexport interface ISale {\n  price: number;\n}\n\nexport function total(sale: ISale): number {\n  return sale.price;\n}\n",
  }
  messages := []string{}
  for file, content := range files {
    messages = append(messages, runDocumentedRule(t, file, content, "{\"symbol\":\"type\"}")...)
  }
  output := strings.Join(messages, "\n")
  if len(messages) != 0 {
    t.Fatalf("unexpected findings: %s", output)
  }
  if strings.Contains(output, "evidence/documented") {
    t.Fatalf("unexpected %q in %s", "evidence/documented", output)
  }
  unrestricted := strings.Join(runDocumentedRule(t, "src/ISale.ts", files["src/ISale.ts"], ""), "\n")
  if !strings.Contains(unrestricted, "Missing JSDoc on exported function 'total'") {
    t.Fatalf("the unselected function must become a finding under the default selection: %s", unrestricted)
  }

}
