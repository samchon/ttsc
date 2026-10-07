import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { TestProject } from "../../../utils/src/TestProject";

/**
 * Verifies operation reviews follow effective servers and authentication.
 *
 * Root inheritance and an equivalent operation override describe the same
 * contract. Security alternatives and scopes are sets; response example arrays
 * and server lists retain their authored order.
 *
 * 1. Load independent root, path, operation and security scheme mutations.
 * 2. Compare affected operations and an explicitly isolated sibling.
 * 3. Distinguish unordered security from ordered payloads and default servers.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the authored loadSwaggerOperations on real temporary documents and compares nonempty operation digests for every named variant. Missing effective contracts, a whole-document hash, or sorting arbitrary arrays each contradict a contrasting assertion.
 * @evidence contracts/testing.md#independent-expectations OpenAPI's operation/path/root server precedence, operation/root security precedence, OR alternatives and scope membership determine equality independently of the digest algorithm. No implementation hash is used as a golden value.
 * @evidence contracts/testing.md#distinguishing-cases Covers root and path inheritance, equivalent explicit contracts, operation overrides, empty security, anonymous alternatives, used and unused schemes, AND versus OR, reordered and duplicate alternatives/scopes, ordered servers and response literals, and absent/empty/default root servers. A separate Swagger 2 group covers host/scheme changes and inherited, explicit, removed, used and unused authentication. The existing reference-provenance units retain recursive and converter coverage.
 * @evidence contracts/testing.md#execution-ownership The test-evidence runner discovers this exported entry. It calls the maintained loader in-process using real files; it builds no native artifact or consumer and starts no product host. One batch loads all variants and each independent assertion is collected before throwing; temporary inputs are removed in finally.
 */
export async function test_swagger_operation_digests_cover_effective_contracts(): Promise<void> {
  const { loadSwaggerOperations } = await import(
    new URL(
      "../../../../packages/evidence/src/internal/loadSwaggerOperations.ts",
      import.meta.url,
    ).href
  );
  const root = TestProject.tmpdir("evidence-effective-contracts-");
  const operation = { responses: { "200": { description: "OK" } } };
  const servers = [{ url: "https://one.invalid", description: "Primary" }];
  const security = [{ Key: [] }];
  const base = {
    openapi: "3.0.3",
    info: { title: "Contracts", version: "1" },
    servers,
    security,
    components: {
      securitySchemes: {
        Key: { type: "apiKey", in: "header", name: "X-Key" },
        OAuth: {
          type: "oauth2",
          flows: {
            clientCredentials: {
              tokenUrl: "https://auth.invalid",
              scopes: { read: "Read", write: "Write" },
            },
          },
        },
      },
    },
    paths: {
      "/a": { get: operation },
      "/isolated": {
        get: { ...structuredClone(operation), servers: [{ url: "/isolated" }], security: [] },
      },
    },
  };
  const variants: Record<string, any> = { baseline: base };
  const variant = (name: string, edit: (document: any) => void): void => {
    const document = structuredClone(base);
    edit(document);
    variants[name] = document;
  };
  variant("root-server", (d) => { d.servers[0].url = "https://two.invalid"; });
  variant("server-variable", (d) => { d.servers[0].variables = { region: { default: "east" } }; });
  variant("used-scheme", (d) => { d.components.securitySchemes.Key.name = "X-Other"; });
  variant("unused-scheme", (d) => { d.components.securitySchemes.OAuth.flows.clientCredentials.tokenUrl = "https://other.invalid"; });
  variant("root-empty-security", (d) => { d.security = []; });
  variant("explicit", (d) => { d.paths["/a"].get.servers = servers; d.paths["/a"].get.security = security; });
  variant("path-equivalent", (d) => { d.paths["/a"].servers = servers; });
  variant("path-override", (d) => { d.paths["/a"].servers = [{ url: "/path" }]; });
  variant("operation-wins", (d) => { d.paths["/a"].servers = [{ url: "/path" }]; d.paths["/a"].get.servers = servers; });
  variant("operation-empty", (d) => { d.paths["/a"].get.security = []; });
  variant("anonymous", (d) => { d.paths["/a"].get.security = [{}, { Key: [] }]; });
  variant("or", (d) => { d.paths["/a"].get.security = [{ OAuth: ["read", "write"] }, { Key: [] }]; });
  variant("or-reordered", (d) => { d.paths["/a"].get.security = [{ Key: [] }, { OAuth: ["write", "read"] }]; });
  variant("or-duplicate", (d) => { d.paths["/a"].get.security = [{ Key: [] }, { OAuth: ["write", "read", "read"] }, { Key: [] }]; });
  variant("and", (d) => { d.paths["/a"].get.security = [{ Key: [], OAuth: ["read", "write"] }]; });
  variant("scope-change", (d) => { d.paths["/a"].get.security = [{ OAuth: ["read"] }, { Key: [] }]; });
  variant("used-oauth", (d) => { d.paths["/a"].get.security = variants.or.paths["/a"].get.security; d.components.securitySchemes.OAuth.flows.clientCredentials.tokenUrl = "https://changed.invalid"; });
  variant("anonymous-reordered", (d) => { d.paths["/a"].get.security = [{ Key: [] }, {}]; });
  variant("servers-ordered", (d) => { d.paths["/a"].get.servers = [{ url: "/one" }, { url: "/two" }]; });
  variant("servers-reversed", (d) => { d.paths["/a"].get.servers = [{ url: "/two" }, { url: "/one" }]; });
  variant("literal", (d) => { d.paths["/a"].get.responses["200"].content = { "application/json": { example: [1, 2] } }; });
  variant("literal-reversed", (d) => { d.paths["/a"].get.responses["200"].content = { "application/json": { example: [2, 1] } }; });
  variant("absent-servers", (d) => { delete d.servers; });
  variant("empty-servers", (d) => { d.servers = []; });
  variant("default-servers", (d) => { d.servers = [{ url: "/" }]; });
  variant("no-security", (d) => { delete d.security; });
  variant("version-3.1", (d) => { d.openapi = "3.1.0"; });
  variant("version-3.2", (d) => { d.openapi = "3.2.0"; });
  variant("path-empty-servers", (d) => { d.paths["/a"].servers = []; });
  variant("operation-empty-servers", (d) => { d.paths["/a"].servers = [{ url: "/path" }]; d.paths["/a"].get.servers = []; });
  variant("scheme-extension", (d) => { d.components.securitySchemes.Key["x-example"] = { $ref: "#/components/schemas/Example" }; d.components.schemas = { Example: { type: "string" } }; });
  variant("scheme-extension-unrelated", (d) => { d.components.securitySchemes.Key["x-example"] = { $ref: "#/components/schemas/Example" }; d.components.schemas = { Example: { type: "number" } }; });
  // Swagger 2 has document host/schemes rather than per-operation servers.
  // Keep its group separate: changing that host necessarily reaches siblings.
  const swagger2 = {
    swagger: "2.0",
    info: { title: "Version 2 contracts", version: "1" },
    host: "one.invalid",
    basePath: "/v1",
    schemes: ["https"],
    security: [{ Key: [] }],
    securityDefinitions: {
      Key: { type: "apiKey", in: "header", name: "X-Key" },
      Unused: { type: "apiKey", in: "header", name: "X-Unused" },
    },
    paths: { "/a": { get: structuredClone(operation) } },
  };
  variants["v2-baseline"] = swagger2;
  for (const [name, edit] of Object.entries({
    host: (d: any) => { d.host = "two.invalid"; },
    scheme: (d: any) => { d.schemes = ["http"]; },
    used: (d: any) => { d.securityDefinitions.Key.name = "X-Other"; },
    unused: (d: any) => { d.securityDefinitions.Unused.name = "X-Other"; },
    explicit: (d: any) => { d.paths["/a"].get.security = [{ Key: [] }]; },
    empty: (d: any) => { d.paths["/a"].get.security = []; },
  })) {
    const document = structuredClone(swagger2);
    edit(document);
    variants[`v2-${name}`] = document;
  }
  const failures: unknown[] = [];
  const check = (name: string, run: () => void): void => {
    try { run(); } catch (cause) { failures.push(new Error(name, { cause })); }
  };
  try {
    await Promise.all(Object.entries(variants).map(([name, value]) =>
      fs.writeFile(path.join(root, `${name}.json`), JSON.stringify(value)),
    ));
    const loaded = await loadSwaggerOperations({ root, sources: Object.keys(variants).map((name) => `${name}.json`) });
    check("every variant normalizes", () => assert.deepEqual(loaded.problems, []));
    const digests = new Map<string, Map<string, string>>();
    for (const document of loaded.documents)
      digests.set(document.source.replace(/\.json$/u, ""), new Map(document.operations.map((o: { path: string; digest: string }) => [o.path, o.digest])));
    const get = (name: string, target = "/a"): string => {
      const digest = digests.get(name)?.get(target);
      assert.match(digest ?? "", /^[0-9a-f]{64}$/u, `${name} ${target} is present`);
      return digest!;
    };
    const compare = (left: string, right: string, equal: boolean): void =>
      check(`${left} versus ${right}`, () => equal ? assert.equal(get(left), get(right)) : assert.notEqual(get(left), get(right)));
    for (const name of ["root-server", "server-variable", "used-scheme", "root-empty-security", "path-override", "operation-empty", "anonymous"])
      compare(name, "baseline", false);
    for (const name of ["unused-scheme", "explicit", "path-equivalent", "operation-wins"])
      compare(name, "baseline", true);
    compare("operation-empty", "root-empty-security", true);
    compare("no-security", "root-empty-security", true);
    compare("or", "or-reordered", true);
    compare("or", "or-duplicate", true);
    compare("or", "and", false);
    compare("or", "scope-change", false);
    compare("or", "used-oauth", false);
    compare("anonymous", "anonymous-reordered", true);
    compare("anonymous", "operation-empty", false);
    compare("servers-ordered", "servers-reversed", false);
    compare("literal", "literal-reversed", false);
    compare("absent-servers", "empty-servers", true);
    compare("absent-servers", "default-servers", true);
    compare("version-3.1", "baseline", true);
    compare("version-3.2", "baseline", true);
    compare("path-empty-servers", "default-servers", true);
    compare("operation-empty-servers", "default-servers", true);
    compare("scheme-extension", "scheme-extension-unrelated", true);
    for (const name of ["host", "scheme", "used", "empty"])
      compare(`v2-${name}`, "v2-baseline", false);
    for (const name of ["unused", "explicit"])
      compare(`v2-${name}`, "v2-baseline", true);
    for (const name of Object.keys(variants).filter((name) => !name.startsWith("v2-")))
      check(`${name} isolated sibling`, () => assert.equal(get(name, "/isolated"), get("baseline", "/isolated")));
  } catch (cause) {
    failures.push(cause);
  } finally {
    try {
      await fs.rm(root, { recursive: true, force: true });
    } catch (cause) {
      failures.push(new Error("temporary input cleanup", { cause }));
    }
  }
  if (failures.length) throw new AggregateError(failures, "Effective Swagger contracts failed");
}
