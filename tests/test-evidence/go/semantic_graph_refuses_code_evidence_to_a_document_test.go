package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies graph refuses code evidence to a document.
 *
 * A Markdown file host pointing at an unqualified type exercises the identity boundary rather than a missing Markdown heading or no selected source.
 *
 * 1. graphRule.Check refuses the Markdown citation naming bare ISale because an unqualified TypeScript target has no module identity.
 * 2. The literal bare-symbol fixture independently requires the module-identity error and @link guidance; the test does not claim all code references from documents are illegal.
 *
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check refuses the Markdown citation naming bare ISale because an unqualified TypeScript target has no module identity.
 * @evidence contracts/testing.md#independent-expectations The literal bare-symbol fixture independently requires the module-identity error and @link guidance; the test does not claim all code references from documents are illegal.
 * @evidence contracts/testing.md#distinguishing-cases A Markdown file host pointing at an unqualified type exercises the identity boundary rather than a missing Markdown heading or no selected source.
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticGraphRefusesCodeEvidenceToADocument owns these assertions. runIndexRule loads the temporary document and parsed ISale population, then calls graphRule.Check with a TypeScript reference.
 */
func TestEvidenceSemanticGraphRefusesCodeEvidenceToADocument(t *testing.T) {
  files := map[string]string{
    "src/sale.ts":  "export interface ISale {}\n",
    "docs/spec.md": "<!-- @evidence ISale This document relies on the sale contract. -->\n",
  }
  messages := runIndexRule(t, files, "{\"claims\":[{\"type\":\"markdown\",\"files\":[\"docs/**/*.md\"],\"symbol\":\"file\",\"reference\":{\"type\":\"typescript\",\"files\":[\"src/**/*.ts\"]}}]}")
  output := strings.Join(messages, "\n")
  if len(messages) == 0 {
    t.Fatal("the negative fixture produced no finding")
  }
  if !strings.Contains(output, "unqualified symbol has no module identity") {
    t.Fatalf("missing %q in %s", "unqualified symbol has no module identity", output)
  }
  if !strings.Contains(output, "@link") {
    t.Fatalf("missing %q in %s", "@link", output)
  }
}
