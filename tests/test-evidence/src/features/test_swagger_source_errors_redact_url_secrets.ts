import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs/promises";
import http from "node:http";

import { TestProject } from "../../../utils/src/TestProject";

/**
 * Verifies source errors hide URL credentials without changing source identity.
 *
 * Node rejects credential-bearing requests before transport. A local HTTP
 * response independently reflects multiple URLs in its status reason, exposing
 * the same boundary for external HTTP errors without replacing fetch.
 *
 * 1. Load credential-bearing and malformed URLs alongside a missing local file.
 * 2. Read a real HTTP failure repeating the source and another secret URL.
 * 3. Require original source identities, useful causes and no secret values.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the authored loader with real Node fetch rejection and a loopback HTTP response. Returned problem identities must remain byte-identical while displayed messages exclude passwords, query tokens and fragments and retain host/path plus the credential or HTTP failure cause.
 * @evidence contracts/testing.md#independent-expectations Literal fake credentials and response status identify forbidden and required text independently of the sanitizer. The missing local pathname must remain visible; no expected message is produced by the implementation.
 * @evidence contracts/testing.md#distinguishing-cases Exercises userinfo/query/fragment together, malformed URL rejection, repeated URLs, another URL with different secrets and an adjacent local filesystem error. Existing transport/cache tests own successful URL source and retry semantics.
 * @evidence contracts/testing.md#execution-ownership This direct test-evidence export calls the maintained loader in the same Node process. The loopback HTTP server supplies a transport response, not a product host, and closes in finally alongside the owned temporary root; no install, build, compiler or sidecar is involved. Independent assertions and source outcomes are collected before the final AggregateError.
 */
export async function test_swagger_source_errors_redact_url_secrets(): Promise<void> {
  const { loadSwaggerOperations } = await import(
    new URL(
      "../../../../packages/evidence/src/internal/loadSwaggerOperations.ts",
      import.meta.url,
    ).href
  );
  const credential =
    "https://fixture-user:fixture-password@example.invalid/schema?token=fixture-token#fixture-fragment";
  const malformed =
    "https://fixture-user:fixture-password@bad%host/schema?token=fixture-token#fixture-fragment";
  const root = TestProject.tmpdir("evidence-url-error-presentation-");
  const local = "absent-fixture-token.json";
  const ambiguous = [
    "https://fixture-user:fixture-password?oops@bad%host/schema?token=fixture-token#fixture-fragment",
    "https://fixture-user:fixture-password#oops@bad%host/schema?token=fixture-token",
  ];
  const other =
    "https://other-user:other-password@other.invalid/api?key=other-token#other-fragment";
  let reflected = "";
  const server = http.createServer((_request, response) => {
    response.writeHead(
      503,
      `Unavailable ${reflected} again ${reflected} other ${other}`,
    );
    response.end();
  });
  const failures: unknown[] = [];
  const check = (name: string, run: () => void): void => {
    try {
      run();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    reflected = `http://127.0.0.1:${address.port}/schema?token=fixture-token#fixture-fragment`;
    const sources = [credential, malformed, ...ambiguous, reflected, local];
    const result = await loadSwaggerOperations({ root, sources });
    check("all problems keep source identity", () =>
      assert.deepEqual(
        result.problems.map((p: { source: string }) => p.source),
        sources,
      ),
    );
    check("no successful documents", () =>
      assert.deepEqual(result.documents, []),
    );
    for (const source of sources) {
      check(source === local ? "local error" : "remote error", () => {
        const problem = result.problems.find(
          (p: { source: string }) => p.source === source,
        );
        assert.ok(problem);
        assert.equal(problem.digest, "");
        if (source === local) {
          assert.ok(problem.message.includes(local));
          assert.match(problem.message, /ENOENT/u);
        } else {
          for (const secret of [
            "fixture-user",
            "fixture-password",
            "fixture-token",
            "fixture-fragment",
            "other-user",
            "other-password",
            "other-token",
            "other-fragment",
          ])
            assert.equal(problem.message.includes(secret), false, secret);
          if (source === credential) {
            assert.match(problem.message, /credentials/u);
            assert.ok(problem.message.includes("example.invalid/schema"));
          }
          if (source === reflected) {
            assert.match(problem.message, /HTTP 503 Unavailable/u);
            assert.ok(problem.message.includes("/schema"));
            assert.ok(problem.message.includes("other.invalid/api"));
          }
        }
      });
    }
  } catch (cause) {
    failures.push(cause);
  } finally {
    if (server.listening)
      try {
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      } catch (cause) {
        failures.push(new Error("HTTP fixture cleanup", { cause }));
      }
    try {
      await fs.rm(root, { recursive: true, force: true });
    } catch (cause) {
      failures.push(new Error("temporary input cleanup", { cause }));
    }
  }
  if (failures.length)
    throw new AggregateError(failures, "Swagger URL error redaction failed");
}
