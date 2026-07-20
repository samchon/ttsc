import { createServer } from "node:http";

import {
  galleryPayload,
  marketplaceProbe,
  silentLogger,
} from "../../internal/marketplace-probe";
import { assert } from "../../internal/toolchain";

/**
 * Verifies transient failures retry through a real local HTTP endpoint.
 *
 * Network errors, rate limits, server failures, and propagation gaps are all
 * expected temporary states around Marketplace publication. The probe must
 * retry them while preserving the exact query and only pass when the requested
 * publisher/name/version becomes public.
 *
 * 1. Inject one network failure, then serve 429, 503, empty, and exact results.
 * 2. Run the waiter against an ephemeral local HTTP Gallery server.
 * 3. Assert the fifth attempt succeeds and every request used the exact filter.
 */
export const test_marketplace_probe_retries_transient_failures = async () => {
  const requestBodies: unknown[] = [];
  let serverAttempts = 0;
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    requestBodies.push(JSON.parse(body));
    serverAttempts += 1;

    if (serverAttempts === 1) {
      response.writeHead(429);
      response.end();
    } else if (serverAttempts === 2) {
      response.writeHead(503);
      response.end();
    } else {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify(
          serverAttempts === 3
            ? { results: [{ extensions: [] }] }
            : galleryPayload("samchon", "ttsc", ["0.19.4"]),
        ),
      );
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  try {
    const address = server.address();
    assert.ok(address !== null && typeof address === "object");
    let fetchAttempts = 0;
    const result = await marketplaceProbe.waitForMarketplace({
      extensionId: "samchon.ttsc",
      version: "0.19.4",
      endpoint: `http://127.0.0.1:${address.port}`,
      timeoutMs: 5_000,
      intervalMs: 1,
      logger: silentLogger,
      fetchImpl: async (input, init) => {
        fetchAttempts += 1;
        if (fetchAttempts === 1) throw new Error("simulated socket reset");
        return fetch(input, init);
      },
    });

    assert.equal(result.version, "0.19.4");
    assert.equal(result.attempts, 5);
    assert.equal(fetchAttempts, 5);
    assert.equal(serverAttempts, 4);
    assert.equal(requestBodies.length, 4);
    for (const body of requestBodies) {
      assert.equal((body as any).filters[0].criteria[0].filterType, 7);
      assert.equal((body as any).filters[0].criteria[0].value, "samchon.ttsc");
    }
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
};
