import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";

import { TestProject } from "../../../utils/src/TestProject";

/**
 * Verifies remote diagnostic presentation hides secrets while transport and
 * returned source identity retain the original address.
 *
 * Native fetch rejects credentials before network access. Other transports may
 * echo malformed or redirect URLs, so the presentation helper also owns those
 * external reason spellings independently of fetch's current error wording.
 *
 * 1. Exercise the actual loader's credential rejection and local read failure.
 * 2. Sanitize repeated, malformed, encoded and redirected URL reasons.
 * 3. Fetch a local HTTP document and verify its original query reaches the server.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual loadSwaggerOperations problem omits URL password/query/fragment secrets, retains source identity and local file errors, and sends an accepted query unchanged to a real loopback HTTP server. swaggerSafeMessage separately redacts repeated and redirect URLs in external reasons.
 * @evidence contracts/testing.md#independent-expectations Literal forbidden sentinel values and retained host/path/cause text define the secrecy contract independently of the sanitizer; the server records the actual transport URL rather than predicting it from the loader.
 * @evidence contracts/testing.md#distinguishing-cases Credentials, query, fragment, percent encoding, malformed host, repeated URLs, missing-host spelling, redirect URL, local filename and successful remote recovery distinguish presentation from source identity and transport.
 * @evidence contracts/testing.md#execution-ownership This discoverable direct unit calls authored loader and sanitizer operations with a temporary directory and in-process HTTP server; no native build, installed artifact or product host runs. Independent cases collect failures and finally awaits server closure and removes its directory.
 */
export async function test_swagger_source_loader_redacts_remote_error_secrets(): Promise<void> {
  const { loadSwaggerOperations } = await import(new URL("../../../../packages/evidence/src/internal/loadSwaggerOperations.ts", import.meta.url).href);
  const { swaggerSafeMessage } = await import(new URL("../../../../packages/evidence/src/internal/swaggerSafeMessage.ts", import.meta.url).href);
  const root = TestProject.tmpdir("swagger-secret-");
  const failures: unknown[] = [];
  const check = async (name: string, run: () => void | Promise<void>) => {
    try { await run(); } catch (cause) { failures.push(new Error(name, {cause})); }
  };
  const source = "https://fixture-user:fixture-password@example.invalid/schema?token=fixture-token#fixture-fragment";
  const safe = (message: string) => {
    for (const secret of ["fixture-user", "fixture-password", "fixture-token", "fixture-fragment", "fixture%2Dpassword", "fixture%2Dtoken"])
      assert.equal(message.includes(secret), false, `${secret}: ${message}`);
  };
  let seen = "";
  const server = http.createServer((request, response) => {
    seen = request.url ?? "";
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({openapi:"3.0.3",info:{title:"Remote",version:"1"},paths:{"/ok":{get:{responses:{"200":{description:"OK"}}}}}}));
  });
  try {
    await check("actual credential rejection", async () => {
      const result = await loadSwaggerOperations({root,sources:[source]});
      assert.equal(result.problems.length,1);
      assert.equal(result.problems[0].source,source);
      safe(result.problems[0].message);
      assert.match(result.problems[0].message,/credentials/);
      assert.match(result.problems[0].message,/example\.invalid\/schema/);
    });
    await check("stable safe presentation", () => {
      const expected = "fetch https://<redacted>@example.invalid/schema?<redacted>#<redacted>";
      assert.equal(swaggerSafeMessage(new Error(`fetch ${source}`),source),expected);
      assert.equal(swaggerSafeMessage(new Error(expected),source),expected);
    });
    for (const remote of [source, "https://fixture-user:fixture-password@bad%zz/schema?token=fixture-token#fixture-fragment", "https:?token=fixture-token#fixture-fragment", "https:fixture-user:fixture-password@example.invalid/schema?token=fixture-token", "https://fixture-user:fixture%2Dpassword@example.invalid/schema?token=fixture%2Dtoken"])
      await check(`external reason ${remote}`, () => {
        const reason = `TLS rejected ${remote}; redirect https://fixture-user:fixture-password@redirect.invalid/next?token=fixture-token#fixture-fragment; retry ${remote}`;
        const message = swaggerSafeMessage(new Error(reason),remote);
        safe(message);
        assert.match(message,/TLS rejected/);
        assert.match(message,/redirect\.invalid\/next/);
      });
    await check("local source remains local", async () => {
      const local = "missing-fixture-password?fixture-token.json";
      const result = await loadSwaggerOperations({root,sources:[local]});
      assert.equal(result.problems.length,1);
      assert.match(result.problems[0].message,/missing-fixture-password\?fixture-token\.json/);
      assert.equal(swaggerSafeMessage(new Error("local ?fixture-token #fixture-fragment"),local),"local ?fixture-token #fixture-fragment");
    });
    await new Promise<void>((resolve, reject) => { server.once("error",reject); server.listen(0,"127.0.0.1",resolve); });
    await check("exact remote transport", async () => {
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      const remote = `http://127.0.0.1:${address.port}/schema?token=fixture-token`;
      const result = await loadSwaggerOperations({root,sources:[remote]});
      assert.deepEqual(result.problems,[]);
      assert.equal(result.documents[0].source,remote);
      assert.equal(result.documents[0].digest,"");
      assert.equal(seen,"/schema?token=fixture-token");
      assert.equal(result.documents[0].operations[0].path,"/ok");
    });
  } catch (error) {
    failures.push(error);
  } finally {
    try {
      if (server.listening) await new Promise<void>((resolve,reject) => server.close(error => error ? reject(error) : resolve()));
    } catch (error) { failures.push(error); }
    try { await fs.rm(root,{recursive:true,force:true}); }
    catch (error) { failures.push(error); }
  }
  if (failures.length) throw new AggregateError(failures,"Swagger URL redaction regressions");
}
