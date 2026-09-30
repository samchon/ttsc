package evidence

import (
  "testing"
)

/**
 * Verifies which sources are classified as remote.
 *
 * The loader's own case above cannot isolate this, so the classifier is pinned
 * directly. Scheme matching is case-insensitive because a configuration is
 * hand-written, and a path merely containing the text is local — the graph's
 * own configuration decoder already refuses anything ambiguous, so this only
 * has to agree with it.
 *
 *  1. Classify http and https sources in mixed case.
 *  2. Classify local paths, including one that merely mentions a scheme.
 *  3. Assert only the true URLs are remote.
 *
 * @evidence contracts/testing.md#behavioral-verification isRemoteSwaggerSource accepts the URL table and rejects the local path table.
 * @evidence contracts/testing.md#independent-expectations Explicit positive/negative strings specify remote classification.
 * @evidence contracts/testing.md#distinguishing-cases HTTP/HTTPS spellings differ from native/local file paths.
 * @evidence contracts/testing.md#execution-ownership TestSwaggerClassifiesRemoteSources is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestSwaggerClassifiesRemoteSources(t *testing.T) {
  for _, source := range []string{
    "http://example.com/swagger.json",
    "https://example.com/swagger.json",
    "HTTPS://EXAMPLE.COM/swagger.json",
  } {
    if !isRemoteSwaggerSource(source) {
      t.Fatalf("%q must be remote", source)
    }
  }
  for _, source := range []string{
    "swagger.json",
    "docs/https-swagger.json",
    "packages/api/openapi.yaml",
  } {
    if isRemoteSwaggerSource(source) {
      t.Fatalf("%q must be local", source)
    }
  }
}
