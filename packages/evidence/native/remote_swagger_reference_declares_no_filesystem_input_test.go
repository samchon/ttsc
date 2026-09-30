package evidence

import (
  "testing"
  "github.com/samchon/ttsc/packages/lint/rule"
)

/**
 * Verifies an HTTP(S) Swagger reference declares no filesystem dependency.
 *
 * The host rejects a remote pattern, and one rejection discards the entire
 * snapshot for every project rule in the run; so a declared URL would not
 * merely fail to help, it would silently un-watch the Markdown globs beside it.
 * That makes this the highest-consequence branch in the contract.
 *
 *  1. Configure one URL Swagger reference beside a Markdown reference.
 *  2. Publish the rule's project inputs.
 *  3. Assert the Markdown glob survives and no file input is declared.
 * @evidence contracts/testing.md#behavioral-verification graphRule.ProjectInputs through declaredInputs is exercised with the scenario below; the assertions require the Markdown glob survives and no file input is declared.
 * @evidence contracts/testing.md#independent-expectations The host rejects a remote pattern, and one rejection discards the entire snapshot for every project rule in the run; so a declared URL would not merely fail to help, it would silently un-watch the Markdown globs beside it. That makes this the highest-consequence branch in the contract.
 * @evidence contracts/testing.md#distinguishing-cases Configure one URL Swagger reference beside a Markdown reference. Publish the rule's project inputs. Assert the Markdown glob survives and no file input is declared.
 * @evidence contracts/testing.md#execution-ownership TestRemoteSwaggerReferenceDeclaresNoFilesystemInput is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestRemoteSwaggerReferenceDeclaresNoFilesystemInput(t *testing.T) {
  inputs := declaredInputs(t, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":[
      {"type":"swagger","file":"https://example.com/v1/swagger.json"},
      {"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
    ]
  }]}`)
  assertDeclares(t, inputs, rule.ProjectInputFile, nil)
  assertDeclares(t, inputs, rule.ProjectInputGlob, []string{"docs/**/*.md"})
}
