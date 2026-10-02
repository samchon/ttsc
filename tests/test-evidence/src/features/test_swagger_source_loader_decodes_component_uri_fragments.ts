import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { TestProject } from "../../../utils/src/TestProject";

/**
 * Verifies component URI fragments select the contract their JSON Pointer names.
 *
 * URI decoding precedes JSON Pointer tokenization. A percent-encoded separator
 * separates tokens, while ~1 represents a slash inside one token. Misordering
 * them can leave a referenced edit invisible or hash an unrelated declaration.
 * Normalized document inputs preserve these literal references through the real
 * converter, so the digest owner, rather than converter rewriting, is exercised.
 *
 * 1. Load independently authored encoded, escaped, nested and array pointers.
 * 2. Compare each operation with a SHA-256 of hand-written canonical JSON, then
 *    edit the selected schema and an unrelated or misleading schema separately.
 * 3. Preserve unresolved malformed, absent, inherited and out-of-scope pointers,
 *    and exercise encoded roots of recursive schemas without duplicate descent.
 * 4. Collect every matrix row's failure before reporting the entry's result.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual loadSwaggerOperations source API and real converter over temporary documents. Exact operation digests distinguish selecting the intended scalar from retaining its reference or selecting a slash-named decoy. Referenced edits must move the digest and unrelated edits must not. Recursive encoded roots must hash the same finite contract as the equivalent plain root.
 * @evidence contracts/testing.md#independent-expectations RFC 6901 sections 3, 4 and 6 establish literal token, escape, array-index and URI-fragment meanings. Expected SHA-256 values hash canonical JSON written in this test, never a value produced by the loader or its canonical serializer. Unresolvable references remain written under the loader's documented contract; this test does not require document rejection.
 * @evidence contracts/testing.md#distinguishing-cases Encoded prefix and separators, lowercase hex, literal slash via ~1/%7E1, ~01, percent and Unicode/empty tokens contrast with malformed percent/tilde escapes, absent or inherited members, wrong-case and non-component scopes. Array index zero contrasts with leading-zero, append and absent indices. Every row compares selected edits against decoy edits and an unchanged sibling operation; plain and encoded recursive roots preserve a finite reference guard.
 * @evidence contracts/testing.md#execution-ownership The matching named src/features export is discovered by test-evidence's runner and selected by its function claim. It imports maintained source directly and invokes real YAML parsing and OpenAPI normalization in the same Node process, with no installed consumer, native build or child host. Every document load records its own failure and only its dependent assertions are blocked; cleanup removes this invocation's exact temporary root.
 */
export async function test_swagger_source_loader_decodes_component_uri_fragments(): Promise<void> {
  const { loadSwaggerOperations } = await import(new URL(
    "../../../../packages/evidence/src/internal/loadSwaggerOperations.ts",
    import.meta.url,
  ).href) as {
    loadSwaggerOperations(request: { root: string; sources: string[] }): Promise<{
      documents: Array<{ source: string; operations: Array<{ method: string; path: string; digest: string }> }>;
      problems: Array<{ source: string; message: string }>;
    }>;
  };
  const root = TestProject.tmpdir("swagger-component-fragments-");
  const failures: Error[] = [];
  const check = (label: string, run: () => void): void => {
    try { run(); } catch (cause) { failures.push(new Error(label, { cause })); }
  };
  const digest = (schema: string): string => createHash("sha256").update(
    '{"requestBody":{"content":{"application/json":{"schema":' + schema +
    '}}},"responses":{"200":{"description":"OK"}}}',
  ).digest("hex");
  const siblingDigest = createHash("sha256").update(
    '{"responses":{"200":{"description":"OK"}}}',
  ).digest("hex");
  const simple = (selected: string, decoy: string) => ({
    Target: { type: selected }, Decoy: { type: decoy },
  });
  const nested = (selected: string, decoy: string) => ({
    Member: { type: "object", properties: { name: { type: selected } } },
    "Member/properties/name": { type: decoy },
    Decoy: { type: decoy },
  });
  const property = (name: string) => (selected: string, decoy: string) => ({
    Member: { type: "object", properties: { [name]: { type: selected } } },
    Decoy: { type: decoy },
  });
  const union = (selected: string, decoy: string) => ({
    Group: { oneOf: [{ type: selected }, { type: decoy }] },
    Decoy: { type: decoy },
  });
  const recursive = (selected: string, decoy: string) => ({
    Node: {
      type: "object",
      properties: { value: { type: selected }, parent: { $ref: "#/components/schemas/Node" } },
    },
    Decoy: { type: decoy },
  });
  const recursiveText = (type: string): string =>
    '{"properties":{"parent":{"$ref":"#/components/schemas/Node"},"value":{"type":' +
    JSON.stringify(type) + '}},"type":"object"}';
  const rows: Array<{
    name: string;
    reference: string;
    schemas: (selected: string, decoy: string) => unknown;
    resolves: boolean;
    recursive?: boolean;
  }> = [
    { name: "plain", reference: "#/components/schemas/Target", schemas: simple, resolves: true },
    { name: "encoded-prefix", reference: "#%2Fcomponents%2Fschemas%2FTarget", schemas: simple, resolves: true },
    { name: "encoded-prefix-lowercase", reference: "#%2fcomponents%2fschemas%2fTarget", schemas: simple, resolves: true },
    { name: "encoded-prefix-text", reference: "#/%63omponents/%73chemas/Target", schemas: simple, resolves: true },
    { name: "nested", reference: "#/components/schemas/Member/properties/name", schemas: nested, resolves: true },
    { name: "encoded-nested-separators", reference: "#/components/schemas/Member%2Fproperties%2Fname", schemas: nested, resolves: true },
    { name: "mixed-separators", reference: "#/components%2Fschemas/Member/properties%2Fname", schemas: nested, resolves: true },
    { name: "literal-slash", reference: "#/components/schemas/Member/properties/slash~1name", schemas: property("slash/name"), resolves: true },
    { name: "encoded-tilde-slash", reference: "#/components/schemas/Member/properties/slash%7E1name", schemas: property("slash/name"), resolves: true },
    { name: "tilde-order", reference: "#/components/schemas/Member/properties/~01", schemas: property("~1"), resolves: true },
    { name: "literal-percent", reference: "#/components/schemas/Member/properties/percent%25key", schemas: property("percent%key"), resolves: true },
    { name: "decode-once", reference: "#/components/schemas/Member/properties/%252F", schemas: property("%2F"), resolves: true },
    { name: "unicode", reference: "#/components/schemas/Member/properties/%C3%A9", schemas: property("é"), resolves: true },
    { name: "empty-token", reference: "#/components/schemas/Member/properties/", schemas: property(""), resolves: true },
    { name: "array-zero", reference: "#/components/schemas/Group/oneOf/0", schemas: union, resolves: true },
    { name: "array-encoded-index", reference: "#/components/schemas/Group/oneOf/%30", schemas: union, resolves: true },
    { name: "array-leading-zero", reference: "#/components/schemas/Group/oneOf/00", schemas: union, resolves: false },
    { name: "array-append", reference: "#/components/schemas/Group/oneOf/-", schemas: union, resolves: false },
    { name: "array-absent", reference: "#/components/schemas/Group/oneOf/2", schemas: union, resolves: false },
    { name: "malformed-percent", reference: "#/components/schemas/Member/properties/bad%Q", schemas: property("bad%Q"), resolves: false },
    { name: "malformed-utf8", reference: "#/components/schemas/Member/properties/%C3%28", schemas: property("%C3%28"), resolves: false },
    { name: "malformed-tilde", reference: "#/components/schemas/Member/properties/bad~2", schemas: property("bad~2"), resolves: false },
    { name: "trailing-tilde", reference: "#/components/schemas/Member/properties/bad~", schemas: property("bad~"), resolves: false },
    { name: "missing", reference: "#/components/schemas/Missing", schemas: simple, resolves: false },
    { name: "inherited", reference: "#/components/schemas/constructor", schemas: simple, resolves: false },
    { name: "wrong-case", reference: "#/Components/schemas/Target", schemas: simple, resolves: false },
    { name: "outside-components", reference: "#/paths/~1selected/post", schemas: simple, resolves: false },
    { name: "external", reference: "other.json#/components/schemas/Target", schemas: simple, resolves: false },
    { name: "plain-recursive", reference: "#/components/schemas/Node", schemas: recursive, resolves: true, recursive: true },
    { name: "encoded-recursive", reference: "#%2Fcomponents%2Fschemas%2FNode", schemas: recursive, resolves: true, recursive: true },
  ];
  try {
    for (const row of rows) {
      for (const [variant, selected, decoy] of [
        ["baseline", "string", "boolean"],
        ["selected-edit", "number", "boolean"],
        ["decoy-edit", "string", "integer"],
      ] as const) {
        const label = row.name + ":" + variant;
        try {
          const source = label.replace(":", "-") + ".json";
          fs.writeFileSync(path.join(root, source), JSON.stringify({
            openapi: "3.2.0",
            "x-typia-emended-v12": true,
            info: { title: "Fragment meanings", version: "1" },
            paths: {
              "/selected": { post: {
                requestBody: { content: { "application/json": { schema: { $ref: row.reference } } } },
                responses: { "200": { description: "OK" } },
              } },
              "/sibling": { get: { responses: { "200": { description: "OK" } } } },
            },
            components: { schemas: row.schemas(selected, decoy) },
          }));
          const result = await loadSwaggerOperations({ root, sources: [source] });
          assert.deepEqual(result.problems, [], label);
          assert.equal(result.documents.length, 1, label);
          const operations = result.documents[0]!.operations;
          check(label + ":identities", () => assert.deepEqual(
            operations.map(operation => [operation.method, operation.path]),
            [["GET", "/sibling"], ["POST", "/selected"]],
          ));
          const expectedSchema = row.resolves
            ? row.recursive ? recursiveText(selected) : '{"type":' + JSON.stringify(selected) + '}'
            : '{"$ref":' + JSON.stringify(row.reference) + '}';
          check(label + ":selected", () => assert.equal(
            operations.find(operation => operation.path === "/selected")?.digest,
            digest(expectedSchema),
          ));
          check(label + ":sibling", () => assert.equal(
            operations.find(operation => operation.path === "/sibling")?.digest,
            siblingDigest,
          ));
        } catch (cause) {
          failures.push(new Error(label + ":load", { cause }));
        }
      }
    }
  } finally {
    check("cleanup:remove", () => fs.rmSync(root, { recursive: true, force: true }));
    check("cleanup:absence", () => assert.equal(fs.existsSync(root), false));
  }
  if (failures.length) throw new AggregateError(failures, "Swagger component URI fragment matrix failed.");
}
