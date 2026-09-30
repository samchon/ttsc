package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies singular reports second identity.
 *
 * Two distinct identities versus one identity with the wrong filename exercise cardinality and naming separately; merged identities are permitted in the companion case.
 *
 * 1. singularRule.Check rejects alpha/beta in one file and independently requires utils.ts to take parseInput.ts identity name.
 * 2. Literal exported identities and expected one-public-identity/file-rename messages follow the supported public-surface contract, not repository layout inspection.
 *
 * @evidence contracts/testing.md#behavioral-verification singularRule.Check rejects alpha/beta in one file and independently requires utils.ts to take parseInput.ts identity name.
 * @evidence contracts/testing.md#independent-expectations Literal exported identities and expected one-public-identity/file-rename messages follow the supported public-surface contract, not repository layout inspection.
 * @evidence contracts/testing.md#distinguishing-cases Two distinct identities versus one identity with the wrong filename exercise cardinality and naming separately; merged identities are permitted in the companion case.
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticSingularReportsSecondIdentity owns these assertions. runSingularRule parses both virtual TypeScript fixtures and invokes singularRule.Check directly; no committed file presence is tested.
 */
func TestEvidenceSemanticSingularReportsSecondIdentity(t *testing.T) {
  files := map[string]string{
    "src/pair.ts":  "export const alpha = 1;\nexport const beta = 2;\n",
    "src/utils.ts": "export function parseInput(value: string): string {\n  return value;\n}\n",
  }
  messages := []string{}
  for file, content := range files {
    messages = append(messages, runSingularRule(t, file, content)...)
  }
  output := strings.Join(messages, "\n")
  if len(messages) == 0 {
    t.Fatal("the negative fixture produced no finding")
  }
  if !strings.Contains(output, "declares exactly one public identity") {
    t.Fatalf("missing %q in %s", "declares exactly one public identity", output)
  }
  if !strings.Contains(output, "Rename the file to 'parseInput.ts'") {
    t.Fatalf("missing %q in %s", "Rename the file to 'parseInput.ts'", output)
  }
}
