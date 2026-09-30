package evidence

import (
  "encoding/json"
  "testing"
)

/**
 * Verifies Swagger configuration: exact local paths and HTTP(S) URLs decode as
 * separate reference-only operation populations.
 *
 * Swagger locations cannot pass through the glob decoder because URL query
 * strings and separators have different meaning there. Reading the decoded
 * model directly pins the singular locator contract, separate obligations, and
 * their internal operation selector.
 *
 *  1. Configure one TypeScript claim over local and remote Swagger references.
 *  2. Decode the public graph without loading either source.
 *  3. Assert normalized exact locations and the operation selector survive.
 *
 * @evidence contracts/testing.md#behavioral-verification decodeGraphConfig retains both exact sources,operation selection and empty glob selectors.
 * @evidence contracts/testing.md#independent-expectations Literal file/URL inputs and operation selector specify exact-reference semantics.
 * @evidence contracts/testing.md#distinguishing-cases Singular Swagger files do not become population globs.
 * @evidence contracts/testing.md#execution-ownership TestSwaggerConfigurationDecodesExactReferenceSources is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestSwaggerConfigurationDecodesExactReferenceSources(t *testing.T) {
  config, problems := decodeGraphConfig(json.RawMessage(`{
    "claims": [{
      "type": "typescript",
      "files": ["src/**"],
      "reference": [
        {"type": "swagger", "file": "api\\swagger.yaml"},
        {"type": "swagger", "file": "https://example.com/openapi.json?version=1"}
      ]
    }]
  }`))
  if len(problems) != 0 {
    t.Fatalf("unexpected decode diagnostics: %v", problems)
  }
  references := config.Claims[0].References
  if len(references) != 2 {
    t.Fatalf("Swagger reference count = %d", len(references))
  }
  if references[0].Type != artifactSwagger || references[1].Type != artifactSwagger {
    t.Fatalf("reference types = %q, %q", references[0].Type, references[1].Type)
  }
  if references[0].Source != "api/swagger.yaml" ||
    references[1].Source != "https://example.com/openapi.json?version=1" {
    t.Fatalf("Swagger sources = %q, %q", references[0].Source, references[1].Source)
  }
  if got := references[0].Symbols.names(); got != "operation" {
    t.Fatalf("Swagger selector = %q", got)
  }
  if len(references[0].Files.Patterns) != 0 {
    t.Fatalf("Swagger source leaked into glob patterns: %+v", references[0].Files)
  }
}
