package evidence

import (
  "testing"
  "github.com/samchon/ttsc/packages/lint/rule"
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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification graphRule.ProjectInputs through declaredInputs is exercised with the scenario below; the assertions require the document is declared exactly once, as a file.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A Swagger reference owns one exact path, so declaring it as a glob would ask the host to maintain a population where a single dependency exists. The kind is what tells the host it must keep watching while the file is missing, which is how a document that has not been generated yet becomes observable the moment it appears.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Configure a claim citing a project-relative Swagger document. Publish the rule's project inputs. Assert the document is declared exactly once, as a file.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestLocalSwaggerReferenceIsDeclaredAsAFile is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
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
