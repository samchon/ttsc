import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { TestProject } from "../../../utils/src/TestProject";

/**
 * Verifies Swagger URL scheme case and local source identity through the real loader.
 *
 * Native configuration preserves the author's URL spelling. The Node bridge must
 * fetch that spelling without mistaking a case variant for a file, while local
 * paths retain their bytes, root and content-cache digest.
 *
 * 1. Share one real loopback server and local document across source spellings.
 * 2. Check remote identities, local byte digests and independently authored operations.
 * 3. Exercise malformed, unsupported, HTTP, TLS and missing-file failures and recovery.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the authored source loadSwaggerOperations API with lower, upper and mixed HTTP schemes; checks literal POST:/Members, exact source spelling, empty remote digest, independent local SHA256, HTTP503 then recovery and real TLS/connection failure. Local relative, ancestor and native absolute paths remain readable while file/FTP URLs and malformed URLs remain problems.
 * @evidence contracts/testing.md#independent-expectations Literal operation/path and server request paths derive from the authored OpenAPI document; local SHA256 covers the authored raw bytes independently of loader output. Scheme equivalence follows URL protocol semantics, while unchanged source identity and error ownership are checked directly. This case exercises source API transport, not native address-cache residency or installed packaging.
 * @evidence contracts/testing.md#distinguishing-cases Three scheme spellings preserve case-sensitive path/query bytes; an HTTPS request to the HTTP-only server must fail without downgrade. Local aliases contrast with unsupported protocols, malformed URLs, directories, missing files and invalid JSON; repaired bytes and a recovered HTTP response succeed after actual failures.
 * @evidence contracts/testing.md#execution-ownership The matching features export is discovered by test-evidence src/index.ts and tests/e2e/evidence.config.json. It imports the owning source API and exercises Node HTTP/fetch/filesystem connections without installing a consumer, building Go or starting a compiler host.
 * @evidence contracts/e2e.md#necessary-boundary Real fetch must accept scheme variants and preserve request path/query through the normalizer; direct URL-parser tests cannot establish transport, HTTP/TLS errors, byte reading or returned source/digest attribution.
 * @evidence contracts/e2e.md#shared-execution One loopback server, one finite local fixture and the same source API serve every control. No installation, native producer or compiler Program is prepared. Trusted external TLS is validated separately so this portable regression has no external-network dependency.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each response/file mutation occurs after the prior owning-API call completes. HTTP503 is restored before a fresh call; local bytes are restored after invalid JSON. The server is joined and the exact tracked fixture removed independently in finally, retaining body and cleanup failures; the final closed-port request uses no live server.
 * @evidence contracts/e2e.md#preserved-coverage This additive case keeps all original compiler/HTTP/cache cases and their assertions. It owns the previously untested JavaScript scheme gate and local/error counterexamples; native configuration, process-address caching and installed producer transport remain in their existing owners.
 */
export async function test_evidence_swagger_loader_preserves_url_scheme_and_local_source_boundaries(): Promise<void> {
  // Load the authored API at runtime without adding package sources to this
  // test project's compiler root. The package owns their separate type check.
  const { loadSwaggerOperations } = await import(new URL(
    "../../../../packages/evidence/src/internal/loadSwaggerOperations.ts",
    import.meta.url,
  ).href) as {
    loadSwaggerOperations(request: { root: string; sources: string[] }): Promise<{
      documents: Array<{ source: string; digest: string; operations: Array<{ method: string; path: string }> }>;
      problems: Array<{ source: string; digest: string; message: string }>;
    }>;
  };
  const failures: unknown[] = [];
  const check = (run: () => void): void => {
    try { run(); } catch (error) { failures.push(error); }
  };
  const root = TestProject.tmpdir("evidence-swagger-source-");
  const project = path.join(root, "project");
  const bytes = JSON.stringify({
    openapi: "3.1.0",
    info: { title: "Source boundaries", version: "1.0.0" },
    paths: { "/Members": { post: { responses: { "200": { description: "OK" } } } } },
  }) + "\n";
  const local = path.join(project, "Contract.JSON");
  const outside = path.join(root, "Contract.JSON");
  const requests: string[] = [];
  let status = 200;
  const server = http.createServer((request, response) => {
    requests.push(request.url ?? "");
    response.writeHead(status, { "content-type": "application/json", connection: "close" });
    response.end(status === 200 ? bytes : "unavailable");
  });
  // Invalid TLS bytes are an actual transport failure, not an HTTP request.
  server.on("clientError", (_error, socket) => socket.destroy());
  let port: number | undefined;
  const inspect = async (sources: string[], expected: "remote" | "local" | "problem") => {
    const result = await loadSwaggerOperations({ root: project, sources });
    for (const source of sources) {
      const document = result.documents.find(value => value.source === source);
      const problem = result.problems.find(value => value.source === source);
      check(() => assert.equal((document ? 1 : 0) + (problem ? 1 : 0), 1, "Each original source must retain one attributed result: " + source));
      if (expected === "problem") {
        check(() => assert.ok(problem && problem.message.length !== 0, "This source must fail: " + source));
      } else {
        check(() => assert.ok(document, "This source must load: " + source + "; " + problem?.message));
        if (document) {
          check(() => assert.deepEqual(document.operations.map(value => [value.method, value.path]), [["POST", "/Members"]]));
          check(() => assert.equal(document.digest, expected === "remote" ? "" : createHash("sha256").update(bytes).digest("hex")));
        }
      }
    }
    return result;
  };
  try {
    fs.mkdirSync(project);
    fs.writeFileSync(local, bytes);
    fs.writeFileSync(outside, bytes);
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    port = address.port;
    const suffix = "://127.0.0.1:" + port + "/OpenAPI.JSON?Revision=1";
    await inspect(["http", "HTTP", "hTtP"].map(scheme => scheme + suffix), "remote");
    check(() => assert.deepEqual(requests.sort(), Array(3).fill("/OpenAPI.JSON?Revision=1"), "All scheme spellings must reach the same unchanged request target."));
    await inspect(["Contract.JSON", "../Contract.JSON", local], "local");
    const refused = await inspect([pathToFileURL(local).href, "ftp://127.0.0.1/document.json", "HTTP://[", "missing.json", "."], "problem");
    for (const source of [pathToFileURL(local).href, "ftp://127.0.0.1/document.json"]) {
      check(() => assert.ok(refused.problems.find(value => value.source === source)?.message.includes("only http: and https:")));
    }
    fs.writeFileSync(local, "not: [valid JSON or YAML");
    const invalid = await inspect(["Contract.JSON"], "problem");
    check(() => assert.equal(invalid.problems[0]?.digest, createHash("sha256").update("not: [valid JSON or YAML").digest("hex"), "A parse failure must retain the identity of successfully read local bytes."));
    fs.writeFileSync(local, bytes);
    await inspect(["Contract.JSON"], "local");
    status = 503;
    const unavailable = await inspect(["hTtP" + suffix], "problem");
    check(() => assert.ok(unavailable.problems[0]?.message.startsWith("HTTP 503")));
    check(() => assert.equal(unavailable.problems[0]?.digest, ""));
    status = 200;
    await inspect(["hTtP" + suffix], "remote");
    const tls = await inspect(["https", "HTTPS", "hTtPs"].map(scheme => scheme + suffix), "problem");
    for (const problem of tls.problems) {
      check(() => assert.equal(problem.message, "fetch failed", "HTTPS must reach TLS and fail against the HTTP-only server, without protocol rejection or downgrade."));
      check(() => assert.equal(problem.digest, ""));
    }
  } catch (error) {
    failures.push(error);
  } finally {
    try {
      if (server.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      check(() => assert.equal(server.listening, false));
    } catch (error) { failures.push(error); }
    try {
      fs.rmSync(root, { recursive: true, force: true });
      check(() => assert.equal(fs.existsSync(root), false));
      console.log("Swagger source boundary cleanup removed: " + root);
    } catch (error) { failures.push(error); }
  }
  if (port !== undefined) {
    const stopped = await inspect(["HTTP://127.0.0.1:" + port + "/OpenAPI.JSON"], "problem");
    check(() => assert.equal(stopped.problems[0]?.message, "fetch failed", "A closed listener must remain a network failure attributed to its original URL."));
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, "Swagger source boundaries and cleanup failed.");
}
