package evidence

import (
  "testing"
)

/**
 * Verifies an operation carries the digest its normalizer computed.
 *
 * Nothing inside an OpenAPI operation hosts an evidence tag and the operation
 * is the unit, so there is no exclusion to apply and no subtree to compose. The
 * only question is whether the value survives the boundary.
 *
 *  1. Materialize an operation whose normalization carried a digest.
 *  2. Materialize one that carried none.
 *  3. Assert each unit reports exactly what it was given.
 *
 * @evidence contracts/testing.md#behavioral-verification swaggerOperationUnit must accept post/members with its literal digest and get/members without one, preserving each supplied value without problems.
 * @evidence contracts/testing.md#independent-expectations The Go constructor must transfer a normalized operation digest exactly and leave a missing one empty.
 * @evidence contracts/testing.md#distinguishing-cases Digest-present versus digest-absent operations challenge accidental synthesis or loss; normalization and schema reachability belong to the real bridge case.
 * @evidence contracts/testing.md#execution-ownership TestSwaggerUnitsCarryTheirNormalizedDigests is a selectable native Go unit entry exercising the owning operations named in its behavioral answer in-process. Its direct fixture values and local comparisons require no installed artifact or product process.
 */
func TestSwaggerUnitsCarryTheirNormalizedDigests(t *testing.T) {
  unit, problem := swaggerOperationUnit("api/openapi.json", swaggerOperation{
    Method: "post",
    Path:   "/members",
    Digest: "operation-digest",
  })
  if problem != "" {
    t.Fatalf("expected a unit, got %q", problem)
  }
  if unit.Digest != "operation-digest" {
    t.Fatalf("reported digest %q, want %q", unit.Digest, "operation-digest")
  }
  bare, problem := swaggerOperationUnit("api/openapi.json", swaggerOperation{
    Method: "get",
    Path:   "/members",
  })
  if problem != "" {
    t.Fatalf("expected a unit, got %q", problem)
  }
  if bare.Digest != "" {
    t.Fatalf("invented digest %q for an operation that carried none", bare.Digest)
  }
}
