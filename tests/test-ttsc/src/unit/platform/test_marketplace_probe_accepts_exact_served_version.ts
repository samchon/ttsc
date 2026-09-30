import {
  galleryPayload,
  jsonResponse,
  marketplaceProbe,
} from "../../internal/marketplace-probe";
import { assert } from "../../internal/script-unit";

/**
 * Verifies an exact public Marketplace version is a repeatable success.
 *
 * The release workflow may be retried after the Gallery already serves the
 * tagged version. Both the readiness lane and exact-version lane must accept
 * that public state instead of treating an already served release as an error.
 *
 * 1. Serve one exact publisher/name record with two valid versions.
 * 2. Query readiness and the tagged version twice against the same response.
 * 3. Assert every query succeeds with the exact public identity and version.
 *
 * @evidence contracts/testing.md#behavioral-verification queryMarketplace returns exact identity, requested older version and all advertised versions across retries.
 * @evidence contracts/testing.md#independent-expectations the release requires returned publisher and name to equal the literal requested extension and version.
 * @evidence contracts/testing.md#distinguishing-cases readiness versus two exact-version retries; every query must request all versions.
 * @evidence contracts/testing.md#execution-ownership The named test_marketplace_probe_accepts_exact_served_version export is discovered under src/unit/platform and calls the owning authored operation without installation, native compilation or a product host.
 */
export async function test_marketplace_probe_accepts_exact_served_version() {
  const queryBodies: any[] = [];
  const fetchImpl: typeof fetch = async (_input, init) => {
    queryBodies.push(JSON.parse(String(init?.body)));
    return jsonResponse(
      galleryPayload("samchon", "ttsc", ["0.19.5", "0.19.4"]),
    );
  };

  const readiness = await marketplaceProbe.queryMarketplace({
    extensionId: "samchon.ttsc",
    fetchImpl,
  });
  assert.equal(readiness.extensionId, "samchon.ttsc");
  assert.equal(readiness.publisher, "samchon");
  assert.equal(readiness.name, "ttsc");
  assert.equal(readiness.version, "0.19.5");

  for (let retry = 0; retry < 2; retry++) {
    const exact = await marketplaceProbe.queryMarketplace({
      extensionId: "samchon.ttsc",
      version: "0.19.4",
      fetchImpl,
    });
    assert.equal(exact.version, "0.19.4");
    assert.deepEqual(exact.versions, ["0.19.5", "0.19.4"]);
  }
  assert.equal(queryBodies.length, 3);
  for (const body of queryBodies)
    assert.equal(
      body.flags,
      1,
      "the query must include all versions, not only the latest",
    );
}
