package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies Swagger operation identity: method case is canonical while path
 * case, parameters, and trailing separators remain exact.
 *
 * The target is the only address a declaration carries. Normalizing the path
 * would silently redirect evidence between distinct OpenAPI operations, while
 * leaving method case unstable would make equivalent dialects disagree.
 *
 *  1. Materialize one mixed-case method and parameterized OpenAPI path.
 *  2. Inspect the resulting evidence unit.
 *  3. Assert its target is the whitespace-free canonical operation identity.
 *
 * @evidence contracts/testing.md#behavioral-verification swaggerOperationUnit uppercases POST and preserves /Members/{memberId}/ and readable text.
 * @evidence contracts/testing.md#independent-expectations Literal method/path and explicit expected target define canonicalization.
 * @evidence contracts/testing.md#distinguishing-cases Method case changes while path case,parameters and trailing slash retain meaning.
 * @evidence contracts/testing.md#execution-ownership TestSwaggerOperationMaterializesCanonicalTarget is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestSwaggerOperationMaterializesCanonicalTarget(t *testing.T) {
  unit, problem := swaggerOperationUnit("api/openapi.yaml", swaggerOperation{
    Method: "post",
    Path:   "/Members/{memberId}/",
  })
  if problem != "" {
    t.Fatal(problem)
  }
  if unit.Target != "POST:/Members/{memberId}/" {
    t.Fatalf("operation target = %q", unit.Target)
  }
  if !strings.Contains(unit.Readable, "POST /Members/{memberId}/") {
    t.Fatalf("operation description = %q", unit.Readable)
  }
}
