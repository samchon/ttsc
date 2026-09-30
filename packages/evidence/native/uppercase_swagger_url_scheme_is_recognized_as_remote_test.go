package evidence

import (
  "testing"
)

/**
 * Verifies an uppercase URL scheme is still recognized as remote.
 *
 * `normalizeSwaggerSource` validates the scheme case-insensitively and then
 * stores the author's spelling, so a source reaches this contract spelled
 * however it was written. A literal `https://` prefix comparison would let
 * `HTTPS://` through and hand the host a pattern it rejects.
 *
 *  1. Configure a Swagger reference whose scheme is uppercase.
 *  2. Publish the rule's project inputs.
 *  3. Assert nothing at all is declared.
 * @evidence contracts/testing.md#behavioral-verification graphRule.ProjectInputs through declaredInputs is exercised with the scenario below; the assertions require nothing at all is declared.
 * @evidence contracts/testing.md#independent-expectations `normalizeSwaggerSource` validates the scheme case-insensitively and then stores the author's spelling, so a source reaches this contract spelled however it was written. A literal `https://` prefix comparison would let `HTTPS://` through and hand the host a pattern it rejects.
 * @evidence contracts/testing.md#distinguishing-cases Configure a Swagger reference whose scheme is uppercase. Publish the rule's project inputs. Assert nothing at all is declared.
 * @evidence contracts/testing.md#execution-ownership TestUppercaseSwaggerURLSchemeIsRecognizedAsRemote is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestUppercaseSwaggerURLSchemeIsRecognizedAsRemote(t *testing.T) {
  inputs := declaredInputs(t, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":{"type":"swagger","file":"HTTPS://example.com/v1/swagger.json"}
  }]}`)
  if len(inputs) != 0 {
    t.Fatalf("expected an uppercase scheme to stay remote, got %v", inputs)
  }
}
