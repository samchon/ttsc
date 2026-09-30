package evidence

import (
  "testing"
)

/**
 * Verifies a rejected document still reports its digest.
 *
 * A rejection is remembered under the bytes that produced it, so a normalizer
 * that returned a digest only on success would leave every broken document
 * re-normalized on every cycle — the state where the edit loop is tightest and
 * the spawn hurts most. The failure would be invisible, because the diagnostic
 * is identical either way.
 *
 *  1. Normalize a document whose OpenAPI version is unsupported.
 *  2. Assert it comes back as a problem rather than an inventory.
 *  3. Assert the problem carries the same digest the native side computes.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification normalizeSwaggerSources returns one unsupported-version problem matching the native digest.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Literal OpenAPI4 is unsupported but readable, so known bytes attribute the rejection.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Readable rejection keeps identity unlike unreadable input.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestSwaggerBridgeReportsADigestForARejectedDocument is one Go E2E overlay entry at tests/test-evidence/go/e2e/swagger_bridge_reports_a_digest_for_a_rejected_document_test.go. The repository runner selects this population separately and overlays it into the native package, preserving access to the actual owner and this function's local case identities.
 * @evidence .agents/skills/contracts/e2e.md#necessary-boundary The native Swagger bridge executes Node against the installed evidence package and compiled Swagger loader, then decodes its real response. normalizeSwaggerSources returns one unsupported-version problem matching the native digest. A supplied DTO cannot prove package resolution, decoder execution or this payload transport.
 * @evidence .agents/skills/contracts/e2e.md#shared-execution All cases reuse the pnpm-installed evidence package and compiled loader in one Go E2E test process. This preserved entry issues its own synchronous Node request for its schema/document inputs; no case installs dependencies or builds a native contributor. Distinct parser inputs justify fresh interpretation, but these per-entry Node lifetimes have not been consolidated into one persistent decoder and are a remaining sharing limitation.
 * @evidence .agents/skills/contracts/e2e.md#state-isolation-and-reuse-validity The swaggerBridgeRoot helper gives this case a private consumer directory under the installed suite and registers t.Cleanup removal. Each synchronous bridge call joins its Node child. The immutable installed loader is shared; loader inventory calls may reuse content-cache outcomes, so this entry does not claim every load is cold. Abrupt process termination may leave the temporary root.
 * @evidence .agents/skills/contracts/e2e.md#preserved-coverage TestSwaggerBridgeReportsADigestForARejectedDocument retains its original function body, local inputs and every assertion after transfer. normalizeSwaggerSources returns one unsupported-version problem matching the native digest. Direct rule/parser/cache decisions stay in native unit entries; neither their passing results nor tag presence certifies this real connection.
 */
func TestSwaggerBridgeReportsADigestForARejectedDocument(t *testing.T) {
  root := swaggerBridgeRoot(t, `{"openapi":"4.0.0","info":{"title":"B","version":"1"},"paths":{}}`)
  result, err := normalizeSwaggerSources(root, []string{"swagger.json"})
  if err != nil {
    t.Fatalf("the bridge must run: %v", err)
  }
  if len(result.Problems) != 1 {
    t.Fatalf("expected one rejected document, got %d (%v)", len(result.Problems), result.Documents)
  }
  native := swaggerContentDigest(root, "swagger.json")
  if result.Problems[0].Digest != native {
    t.Fatalf(
      "a rejection must be attributable to the bytes that caused it\n  bridge: %q\n  native: %q",
      result.Problems[0].Digest,
      native,
    )
  }
}
