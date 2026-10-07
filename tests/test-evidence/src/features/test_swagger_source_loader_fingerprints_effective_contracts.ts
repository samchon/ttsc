import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { TestProject } from "../../../utils/src/TestProject";

/**
 * Verifies operation digests include effective server and security contracts.
 *
 * OpenAPI inheritance and security's set-like alternatives must agree across
 * explicit and inherited spellings without sorting preference or payload arrays.
 *
 * 1. Load independent mutations of root, path and operation settings.
 * 2. Compare equivalent security spellings and changes to used schemes.
 * 3. Retain unrelated operations, schemes and ordered payload distinctions.
 *
 * @evidence contracts/testing.md#behavioral-verification The authored loadSwaggerOperations digests change for effective servers, security and used scheme edits, and agree for inherited/explicit equivalent contracts and reordered security alternatives/scopes.
 * @evidence contracts/testing.md#independent-expectations OpenAPI server precedence and security OR/AND semantics determine equality; literal variants assert relations without computing expected hashes with production helpers.
 * @evidence contracts/testing.md#distinguishing-cases Root/path/operation overrides, absent/empty/default servers, absent/empty/anonymous security, scopes, used/unused/missing schemes, additional methods, versions and ordered examples distinguish semantic edits from unrelated changes.
 * @evidence contracts/testing.md#execution-ownership This direct TypeScript unit writes isolated temporary documents and calls the authored loader through the existing unit runner; no native producer, installation or product host is needed. All independent rows run before failures are aggregated and the directory is removed in finally.
 */
export async function test_swagger_source_loader_fingerprints_effective_contracts(): Promise<void> {
  const { loadSwaggerOperations } = await import(
    new URL("../../../../packages/evidence/src/internal/loadSwaggerOperations.ts", import.meta.url).href
  );
  const root = TestProject.tmpdir("swagger-effective-");
  const failures: unknown[] = [];
  const base = () => ({
    openapi: "3.0.3", info: { title: "Contract", version: "1" },
    servers: [{ url: "https://one.invalid" }],
    security: [{ Key: [] }],
    components: { securitySchemes: {
      Key: { type: "apiKey", in: "header", name: "X-Key" },
      OAuth: { type: "oauth2", flows: { clientCredentials: {
        tokenUrl: "https://auth.invalid/token", scopes: { read: "Read", write: "Write" },
      } } },
    } },
    paths: {
      "/a": { get: { responses: { "200": { description: "OK" } } } },
      "/b": { get: { security: [], servers: [{ url: "/stable" }], responses: { "200": { description: "OK" } } } },
    },
  });
  const digest = async (name: string, document: any): Promise<Record<string, string>> => {
    await fs.writeFile(path.join(root, `${name}.json`), JSON.stringify(document));
    const result = await loadSwaggerOperations({ root, sources: [`${name}.json`] });
    assert.deepEqual(result.problems, [], name);
    return Object.fromEntries(result.documents[0].operations.map((op: any) => [`${op.method}:${op.path}`, op.digest]));
  };
  const rows: Array<[string, (d: any) => void, boolean, boolean?]> = [
    ["root-server", d => { d.servers[0].url = "https://two.invalid"; }, false, true],
    ["path-server", d => { d.paths["/a"].servers = [{ url: "/path" }]; }, false, true],
    ["operation-server", d => { d.paths["/a"].get.servers = [{ url: "/op" }]; }, false, true],
    ["empty-operation-servers", d => { d.paths["/a"].get.servers = []; }, false, true],
    ["empty-path-servers", d => { d.paths["/a"].servers = []; }, false, true],
    ["explicit-server", d => { d.paths["/a"].get.servers = d.servers; }, true],
    ["path-equivalent", d => { d.paths["/a"].servers = d.servers; }, true],
    ["operation-precedence", d => { d.paths["/a"].servers = [{url:"/ignored"}]; d.paths["/a"].get.servers = d.servers; }, true],
    ["explicit-security", d => { d.paths["/a"].get.security = d.security; }, true],
    ["root-security-empty", d => { d.security = []; }, false, true],
    ["operation-security-empty", d => { d.paths["/a"].get.security = []; }, false, true],
    ["anonymous-security", d => { d.security = [{}]; }, false, true],
    ["used-scheme", d => { d.components.securitySchemes.Key.name = "X-Other"; }, false, true],
    ["missing-used-scheme", d => { delete d.components.securitySchemes.Key; }, false, true],
    ["unused-scheme", d => { d.components.securitySchemes.OAuth.flows.clientCredentials.tokenUrl = "https://other.invalid"; }, true],
    ["unrelated-operation", d => { d.paths["/b"].get.responses["200"].description = "Other"; }, true, false],
    ["version-31", d => { d.openapi = "3.1.0"; }, true],
    ["version-32", d => { d.openapi = "3.2.0"; }, true],
  ];
  try {
    const original = await digest("base", base());
    for (const [name, mutate, equal, siblingEqual] of rows) {
      try {
        const d = base(); mutate(d);
        const result = await digest(name, d);
        assert.equal(result["GET:/a"] === original["GET:/a"], equal, name);
        if (siblingEqual !== undefined)
          assert.equal(result["GET:/b"] === original["GET:/b"], siblingEqual, `${name} sibling`);
      } catch (error) { failures.push(new Error(name, { cause: error })); }
    }
    const pairs: Array<[string, (d: any) => void, (d: any) => void, boolean]> = [
      ["security-order", d => { d.security = [{ OAuth: ["read", "write"], Key: [] }, {}]; }, d => { d.security = [{}, { Key: [], OAuth: ["write", "read"] }]; }, true],
      ["scope-change", d => { d.security = [{ OAuth: ["read"] }]; }, d => { d.security = [{ OAuth: ["write"] }]; }, false],
      ["used-oauth-definition", d => { d.security = [{ OAuth: ["read"] }]; }, d => { d.security = [{ OAuth: ["read"] }]; d.components.securitySchemes.OAuth.flows.clientCredentials.scopes.read = "Changed contract"; }, false],
      ["absent-security", d => { delete d.security; }, d => { d.security = []; }, true],
      ["empty-versus-anonymous", d => { d.security = []; }, d => { d.security = [{}]; }, false],
      ["default-server", d => { delete d.servers; }, d => { d.servers = [{url:"/"}]; }, true],
      ["empty-root-server", d => { d.servers = []; }, d => { delete d.servers; }, true],
      ["server-order", d => { d.servers = [{url:"/one"},{url:"/two"}]; }, d => { d.servers = [{url:"/two"},{url:"/one"}]; }, false],
      ["literal-array-order", d => { d.paths["/a"].get["x-example"] = [1,2]; }, d => { d.paths["/a"].get["x-example"] = [2,1]; }, false],
      ["root-literal-reference", d => { d.components.schemas = {Literal:{type:"string"}}; d.paths["/a"].get["x-example"] = {$ref:"#/components/schemas/Literal"}; }, d => { d.components.schemas = {Literal:{type:"number"}}; d.paths["/a"].get["x-example"] = {$ref:"#/components/schemas/Literal"}; }, true],
      ["server-literal-reference", d => { d.components.schemas = {Literal:{type:"string"}}; d.servers[0]["x-example"] = {$ref:"#/components/schemas/Literal"}; }, d => { d.components.schemas = {Literal:{type:"number"}}; d.servers[0]["x-example"] = {$ref:"#/components/schemas/Literal"}; }, true],
      ["operation-server-literal-reference", d => { d.components.schemas = {Literal:{type:"string"}}; d.paths["/a"].get.servers = [{url:"/","x-example":{$ref:"#/components/schemas/Literal"}}]; }, d => { d.components.schemas = {Literal:{type:"number"}}; d.paths["/a"].get.servers = [{url:"/","x-example":{$ref:"#/components/schemas/Literal"}}]; }, true],
      ["scheme-literal-reference", d => { d.components.schemas = {Literal:{type:"string"}}; d.components.securitySchemes.Key["x-example"] = {$ref:"#/components/schemas/Literal"}; }, d => { d.components.schemas = {Literal:{type:"number"}}; d.components.securitySchemes.Key["x-example"] = {$ref:"#/components/schemas/Literal"}; }, true],
      ["oauth-literal-scope-name", d => { d.security = [{OAuth:[]}]; d.components.schemas = {Literal:{type:"string"}}; d.components.securitySchemes.OAuth.flows.clientCredentials.scopes = {$ref:"#/components/schemas/Literal"}; }, d => { d.security = [{OAuth:[]}]; d.components.schemas = {Literal:{type:"number"}}; d.components.securitySchemes.OAuth.flows.clientCredentials.scopes = {$ref:"#/components/schemas/Literal"}; }, true],
      ["scheme-root-reference", d => { d.components.securitySchemes.Key = {$ref:"#/components/securitySchemes/Actual"}; d.components.securitySchemes.Actual = {type:"apiKey",in:"header",name:"X-Key"}; }, d => { d.components.securitySchemes.Key = {$ref:"#/components/securitySchemes/Actual"}; d.components.securitySchemes.Actual = {type:"apiKey",in:"header",name:"X-Other"}; }, false],
      ["additional-operation", d => { d.paths["/a"].additionalOperations = {query:d.paths["/a"].get}; }, d => { d.paths["/a"].additionalOperations = {query:d.paths["/a"].get}; d.servers = [{url:"/changed"}]; }, false],
    ];
    for (const [name, a, b, equal] of pairs) {
      try {
        const left = base(), right = base(); a(left); b(right);
        const x = await digest(`${name}-a`, left), y = await digest(`${name}-b`, right);
        const target = name === "additional-operation" ? "QUERY:/a" : "GET:/a";
        assert.ok(x[target], `${name} target`);
        assert.equal(x[target] === y[target], equal, name);
      } catch (error) { failures.push(new Error(name, { cause: error })); }
    }
    const legacy = () => ({swagger:"2.0",info:{title:"Legacy",version:"1"},schemes:["https"],host:"one.invalid",basePath:"/",security:[{Key:[]}],securityDefinitions:{Key:{type:"apiKey",in:"header",name:"X-Key"}},paths:{"/a":{get:{responses:{"200":{description:"OK"}}}}}});
    for (const [name, mutate, equal] of [
      ["legacy-server", (d: any) => {d.host="two.invalid";}, false],
      ["legacy-used-scheme", (d: any) => {d.securityDefinitions.Key.name="X-Other";}, false],
      ["legacy-empty-security", (d: any) => {d.security=[];}, false],
      ["legacy-equivalent-security", (d: any) => {d.paths["/a"].get.security=d.security;}, true],
    ] as const) {
      try {
        const left=legacy(),right=legacy(); mutate(right);
        const a=await digest(`${name}-a`,left),b=await digest(`${name}-b`,right);
        assert.equal(a["GET:/a"] === b["GET:/a"],equal,name);
      } catch (cause) { failures.push(new Error(name,{cause})); }
    }
  } catch (error) { failures.push(error); }
  finally {
    try { await fs.rm(root, {recursive:true,force:true}); }
    catch (error) { failures.push(error); }
  }
  if (failures.length) throw new AggregateError(failures, "Effective Swagger contract regressions");
}
