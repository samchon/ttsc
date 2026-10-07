package evidence

import (
  "github.com/samchon/ttsc/packages/lint/rule"
  "testing"
)

/**
 * Verifies a local Swagger reference is declared as one exact file.
 *
 * A Swagger reference owns one exact path, so declaring it as a glob would ask
 * the host to maintain a population where a single dependency exists. The kind
 * is what tells the host it must keep watching while the file is missing, which
 * is how a document that has not been generated yet becomes observable the
 * moment it appears.
 *
 *  1. Configure a claim citing a project-relative Swagger document.
 *  2. Publish the rule's project inputs.
 *  3. Assert the document is declared exactly once, as a file.
 *
 * @evidence contracts/testing.md#behavioral-verification declaredInputs calls graphRule.ProjectInputs on a TypeScript claim referencing a local Swagger file, and assertDeclares requires exactly one file-kind input, assets/swagger.json, and no glob-kind input.
 * @evidence contracts/testing.md#independent-expectations The literal expectation of a single file input with the configured path follows from the ProjectInputs contract that a Swagger reference is one exact path; it is authored in the test, not computed by the implementation.
 * @evidence contracts/testing.md#distinguishing-cases The file-kind assertion and the empty glob-kind assertion separate a file declaration from a glob declaration, and the TypeScript claim's own src/** files add no input; remote URL sources, rooted references and Markdown or Prisma globs are not run in this body.
 * @evidence contracts/testing.md#execution-ownership TestLocalSwaggerReferenceIsDeclaredAsAFile is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestLocalSwaggerReferenceIsDeclaredAsAFile(t *testing.T) {
  inputs := declaredInputs(t, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":{"type":"swagger","file":"assets/swagger.json"}
  }]}`)
  assertDeclares(t, inputs, rule.ProjectInputFile, []string{"assets/swagger.json"})
  assertDeclares(t, inputs, rule.ProjectInputGlob, nil)
}
