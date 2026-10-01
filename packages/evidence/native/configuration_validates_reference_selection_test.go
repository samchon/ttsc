package evidence

import (
  "testing"
)

func decodeReferenceProblems(t *testing.T, reference string) []string {
  t.Helper()
  _, problems := decodeGraphConfig([]byte(`{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":` + reference + `
  }]}`))
  return problems
}

/**
 * Verifies a TypeScript reference refuses the singular `file`.
 *
 * Singular `file` belongs to Swagger, which owns one document. A TypeScript
 * population is always a module set, so accepting the key would leave a
 * configuration that reads as selecting something and selects nothing.
 *
 *  1. Configure `file` on a TypeScript reference.
 *  2. Decode the configuration.
 *  3. Assert the key is rejected and names the repair.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual decodeGraphConfig and decoded native model are evaluated; this case asserts the singular file key on a TypeScript reference is refused with the files-glob repair.
 *
 * @evidence contracts/testing.md#independent-expectations TypeScript populations use files globs; singular file belongs to Swagger. The authored TypeScript misuse must yield the literal files-glob repair.
 *
 * @evidence contracts/testing.md#distinguishing-cases The singular file key on a TypeScript reference is refused with the files-glob repair.
 *
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticConfigurationRejectsFileOnTypeScriptReferences is a Go unit entry in the native test process; it decodes one in-memory JSON reference through the decodeReferenceProblems helper (defined in this file) and decodeGraphConfig with no filesystem, package installation, artifact build or product host, and has a single case with no table.
 */
func TestEvidenceSemanticConfigurationRejectsFileOnTypeScriptReferences(t *testing.T) {
  assertProblemContains(
    t,
    decodeReferenceProblems(t, `{"type":"typescript","file":"src/index.ts"}`),
    "a TypeScript reference selects its population with 'files' globs",
  )
}
