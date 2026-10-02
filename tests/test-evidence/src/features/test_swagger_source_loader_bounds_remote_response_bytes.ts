import assert from "node:assert/strict";
import http from "node:http";

/**
 * Verifies a remote Swagger response is read only up to the document limit.
 *
 * A URL source has no stat to admit it, so the limit applies to the bytes the
 * stream actually delivers. A document exactly at the limit must load and one
 * byte more must be refused, whatever the response claims about its length.
 *
 * 1. Serve one valid OpenAPI document padded to exactly 16MiB over loopback HTTP.
 * 2. Serve the same document one byte larger, streamed in chunks.
 * 3. Require the first to load with an empty digest and the second to become a
 *    size problem attributed to its URL.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the authored loadSwaggerOperations source API against a real loopback HTTP server through the actual fetch implementation. The exact-limit document must load with the literal POST operation and the over-limit stream must produce a source problem instead of a document.
 * @evidence contracts/testing.md#independent-expectations The 16777216 byte limit is the loader's documented contract and the payload sizes are authored literals; operation identity is the authored path and method, and the empty digest follows the documented rule that a remote source has no content-cache digest.
 * @evidence contracts/testing.md#distinguishing-cases Exactly the limit is the accepting boundary and limit plus one the rejecting one, with identical content apart from trailing padding, so an off-by-one in either direction fails exactly one arm.
 * @evidence contracts/testing.md#execution-ownership The matching src/features export is discovered by test-evidence's runner and central function claim. It imports the maintained loader and serves its own loopback server in the same Node process, closing it before returning, with no consumer installation, Go build or compiler host.
 */
export async function test_swagger_source_loader_bounds_remote_response_bytes(): Promise<void> {
  const { loadSwaggerOperations } = (await import(
    new URL(
      "../../../../packages/evidence/src/internal/loadSwaggerOperations.ts",
      import.meta.url,
    ).href
  )) as {
    loadSwaggerOperations(request: {
      root: string;
      sources: string[];
    }): Promise<{
      documents: Array<{
        source: string;
        digest: string;
        operations: Array<{ method: string; path: string }>;
      }>;
      problems: Array<{ source: string; message: string; digest: string }>;
    }>;
  };
  const limit = 16 * 1024 * 1024;
  const document = Buffer.from(
    JSON.stringify({
      openapi: "3.1.0",
      info: { title: "Remote bound", version: "1.0.0" },
      paths: { "/Members": { post: { responses: { "200": { description: "OK" } } } } },
    }),
  );
  const payload = (length: number): Buffer =>
    Buffer.concat([document, Buffer.alloc(length - document.length, 32)]);
  const bodies: Record<string, Buffer> = {
    "/exact.json": payload(limit),
    "/over.json": payload(limit + 1),
  };
  const server = http.createServer((request, response) => {
    const body = bodies[request.url ?? ""];
    if (body === undefined) {
      response.writeHead(404).end();
      return;
    }
    // No content-length: the loader must count what arrives, not trust a header.
    response.writeHead(200, { "content-type": "application/json" });
    for (let offset = 0; offset < body.length; offset += 1024 * 1024)
      response.write(body.subarray(offset, offset + 1024 * 1024));
    response.end();
  });
  const failures: unknown[] = [];
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const origin = `http://127.0.0.1:${address.port}`;
    const result = await loadSwaggerOperations({
      root: process.cwd(),
      sources: [`${origin}/exact.json`, `${origin}/over.json`],
    });
    try {
      assert.equal(result.documents.length, 1);
      assert.equal(result.documents[0]!.source, `${origin}/exact.json`);
      assert.equal(result.documents[0]!.digest, "");
      assert.deepEqual(
        result.documents[0]!.operations.map((value) => [value.method, value.path]),
        [["POST", "/Members"]],
      );
      assert.equal(result.problems.length, 1);
      assert.equal(result.problems[0]!.source, `${origin}/over.json`);
      assert.equal(
        result.problems[0]!.message,
        "the Swagger document exceeds the 16777216 byte limit",
      );
      assert.equal(result.problems[0]!.digest, "");
    } catch (error) {
      failures.push(error);
    }
  } catch (error) {
    failures.push(error);
  } finally {
    try {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      assert.equal(server.listening, false);
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1)
    throw new AggregateError(failures, "Remote Swagger bound and cleanup failed.");
}
