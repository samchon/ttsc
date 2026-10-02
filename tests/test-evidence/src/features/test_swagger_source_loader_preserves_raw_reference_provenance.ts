import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { TestProject } from "../../../utils/src/TestProject";

/**
 * Verifies raw OpenAPI conversion keeps the source and meaning of schema refs.
 *
 * A version upgrader can turn a nested or foreign reference into a local schema
 * with the same final token. Private names used to preserve its original target
 * must not leak into digests, bind author-written data or change cycle guards.
 * These inputs omit the emended marker and therefore exercise real conversion.
 *
 * 1. Load raw 3.1/3.2 pointers with selected, decoy and unrelated edits.
 * 2. Require literal operation hashes for ordinary, tuple, recursive and allOf
 *    targets, and for schema seeds reached through real operation holders.
 * 3. Preserve reference-shaped data, namespace collisions and untouched siblings;
 *    unresolved allOf controls require invariance without inventing their shape.
 * 4. Collect every independent load and assertion before reporting failures.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual loadSwaggerOperations source over raw documents, using the real YAML parser and version upgrader. Exact operation digests distinguish original targets from final-token decoys; selected edits change the literal expected contract while decoy and unrelated edits leave it intact. Tuple relocation, allOf object merging, recursive guard identity and reference-shaped data are observable through those operation digests. The existing normalized-fragment test owns the marked-document branch and stays unchanged.
 * @evidence contracts/testing.md#independent-expectations RFC 6901 establishes original local pointer selection and invalid escapes. Expected SHA-256 hashes use independently written canonical operation JSON, not loader output or its serializer. Literal merged object properties and finite recursive boundaries state the selected contracts. Foreign/non-component allOf controls assert only that unrelated local edits cannot affect them: the standard upgrader's unresolved-allOf representation is not claimed to preserve a literal reference. This entry does not certify unsupported raw dialects or webhook operation materialization.
 * @evidence contracts/testing.md#distinguishing-cases Both raw versions cover plain/encoded prefixes and keys, plain/encoded nested targets, escaped names, missing/malformed/foreign/non-component references, a raw tuple item, plain/encoded self and mutual cycles, allOf selected objects and unresolved controls. Author-written alias keys and alias-looking data contrast with private allocation; example/default/const/enum/extension objects containing $ref remain data. Request/response content, path/operation/component parameters, response/component headers and body/response components carry schema references; 3.2 itemSchema and each dialect's additional operations retain their real holders. Unrelated component and webhook additions must not move selected or sibling digests.
 * @evidence contracts/testing.md#execution-ownership The matching named src/features export uses maintained source directly in the unit runner's Node process, with no installed consumer, native build or product child. Each row/version/edit has its own load and failure label. Failed admission blocks only that load's dependent assertions; independent inputs continue. Unresolved-allOf comparisons blocked by a missing baseline are not coverage. Cleanup removes only this invocation's tracked temporary root and collects removal and absence failures separately. The function claim's existing src/features glob will select the added entry; runtime execution and exact scanner census must be verified separately when execution is authorized.
 */
export async function test_swagger_source_loader_preserves_raw_reference_provenance(): Promise<void> {
  const { loadSwaggerOperations } = await import(new URL(
    "../../../../packages/evidence/src/internal/loadSwaggerOperations.ts",
    import.meta.url,
  ).href) as {
    loadSwaggerOperations(request: { root: string; sources: string[] }): Promise<{
      documents: Array<{ operations: Array<{ method: string; path: string; digest: string }> }>;
      problems: unknown[];
    }>;
  };
  type Input = {
    schema?: unknown;
    schemas?: Record<string, unknown>;
    components?: Record<string, unknown>;
    operation?: Record<string, unknown>;
    pathParameters?: unknown[];
    custom?: boolean;
  };
  type Row = {
    name: string;
    input: (selected: string, decoy: string) => Input;
    expected?: (selected: string) => string;
    version?: "3.2.0";
  };
  const scalar = (type: string) => ({ type });
  const scalarText = (type: string): string => '{"type":' + JSON.stringify(type) + '}';
  const ref = (value: string) => ({ $ref: value });
  const target = "#/components/schemas/Target";
  const encoded = "#%2Fcomponents%2Fschemas%2FTarget";
  const decoyRef = "#/components/schemas/Decoy";
  const ok = { "200": { description: "OK" } };
  const post = (schema: unknown) => ({
    requestBody: { content: { "application/json": { schema } } }, responses: ok,
  });
  const postText = (schema: string): string =>
    '{"requestBody":{"content":{"application/json":{"schema":' + schema +
    '}}},"responses":{"200":{"description":"OK"}}}';
  const literalRefText = (reference: string): string =>
    '{"$ref":' + JSON.stringify(reference) + '}';
  const objectText = (type: string): string =>
    '{"properties":{"name":' + scalarText(type) + '},"type":"object"}';
  const nodeText = (type: string, boundary = "#/components/schemas/Node"): string =>
    '{"properties":{"parent":' + literalRefText(boundary) + ',"value":' +
    scalarText(type) + '},"type":"object"}';
  const schemas = (selected: string, decoy: string): Record<string, unknown> => ({
    Target: scalar(selected), Decoy: scalar(decoy),
    Member: { type: "object", properties: { name: scalar(selected) } },
    name: scalar(decoy), "Member/properties/name": scalar(decoy),
    "slash/name": scalar(selected), "percent%key": scalar(selected),
    "%ZZ": scalar(selected), "bad~2": scalar(selected),
  });
  const pointer = (name: string, reference: string, resolves: boolean, object = false): Row => ({
    name,
    input: (selected, decoy) => ({ schema: ref(reference), schemas: schemas(selected, decoy) }),
    expected: selected => postText(resolves
      ? object ? objectText(selected) : scalarText(selected)
      : literalRefText(reference)),
  });
  const rows: Row[] = [
    pointer("plain", target, true),
    pointer("encoded-prefix", encoded, true),
    pointer("encoded-key", "#/components/schemas/%54arget", true),
    pointer("whole-component", "#/components/schemas/Member", true, true),
    pointer("nested-plain", "#/components/schemas/Member/properties/name", true),
    pointer("nested-encoded", "#/components/schemas/Member%2Fproperties%2Fname", true),
    pointer("escaped-name", "#/components/schemas/slash~1name", true),
    pointer("percent-name", "#/components/schemas/percent%25key", true),
    pointer("foreign-document", "https://example.invalid/schema.json#/components/schemas/Target", false),
    pointer("non-component", "#/unrelated/Target", false),
    pointer("missing", "#/components/schemas/Missing", false),
    pointer("malformed-percent", "#/components/schemas/%ZZ", false),
    pointer("malformed-tilde", "#/components/schemas/bad~2", false),
    {
      name: "raw-tuple-item",
      input: (selected, decoy) => ({
        schema: ref("#/components/schemas/Tuple/items/0"),
        schemas: { Tuple: { type: "array", items: [scalar(selected), scalar(decoy)] } },
      }),
      expected: selected => postText(scalarText(selected)),
    },
  ];
  for (const [name, rootReference, edge] of [
    ["self-plain", "#/components/schemas/Node", "#/components/schemas/Node"],
    ["self-encoded-root", "#%2Fcomponents%2Fschemas%2FNode", "#/components/schemas/Node"],
    ["self-encoded-edge", "#/components/schemas/Node", "#%2fcomponents%2fschemas%2fNode"],
  ] as const) rows.push({
    name,
    input: selected => ({ schema: ref(rootReference), schemas: {
      Node: { type: "object", properties: { value: scalar(selected), parent: ref(edge) } },
    } }),
    expected: selected => postText(nodeText(selected, edge)),
  });
  rows.push({
    name: "mutual-cycle",
    input: selected => ({ schema: ref("#%2Fcomponents%2Fschemas%2FA"), schemas: {
      A: { type: "object", properties: { value: scalar(selected), next: ref("#/components/schemas/B") } },
      B: { type: "object", properties: { parent: ref("#/components/schemas/A") } },
    } }),
    expected: selected => postText('{"properties":{"next":{"properties":{"parent":' +
      literalRefText("#/components/schemas/A") + '},"type":"object"},"value":' +
      scalarText(selected) + '},"type":"object"}'),
  });
  for (const [name, reference, resolves] of [
    ["allOf-nested", "#/components/schemas/Holder/properties/part", true],
    ["allOf-encoded", "#%2Fcomponents%2Fschemas%2FHolder%2Fproperties%2Fpart", true],
    ["allOf-foreign", "other.json#/components/schemas/part", false],
    ["allOf-non-component", "#/elsewhere/part", false],
  ] as const) rows.push({
    name,
    input: (selected, decoy) => ({
      schema: { allOf: [ref(reference), {
        type: "object", properties: { stable: scalar("boolean") }, required: ["stable"],
      }] },
      schemas: {
        Holder: { type: "object", properties: { part: {
          type: "object", properties: { name: scalar(selected) }, required: ["name"],
        } } },
        part: { type: "object", properties: { wrong: scalar(decoy) } },
      },
    }),
    expected: resolves ? selected => postText('{"properties":{"name":' + scalarText(selected) +
      ',"stable":{"type":"boolean"}},"required":["name","stable"],"type":"object"}') : undefined,
  });
  rows.push({
    name: "author-alias-key",
    input: selected => ({ schema: ref("#/components/schemas/_ttsc_schema_reference_0"),
      schemas: { _ttsc_schema_reference_0: scalar(selected) } }),
    expected: selected => postText(scalarText(selected)),
  });
  for (const field of ["example", "default", "const", "enum", "x-data"] as const) rows.push({
    name: "literal-data-" + field,
    input: selected => ({ schema: field === "const" ? { const: ref(decoyRef) }
      : field === "enum" ? { enum: [ref(decoyRef)] }
      : field === "default" ? { type: "object", properties: { value: scalar(selected) }, default: ref(decoyRef) }
      : { type: selected, [field]: ref(decoyRef) } }),
    expected: selected => postText(field === "const" ? '{"const":' + literalRefText(decoyRef) + '}'
      : field === "enum" ? '{"enum":[' + literalRefText(decoyRef) + ']}'
      : field === "default" ? '{"default":' + literalRefText(decoyRef) + ',"properties":{"value":' +
        scalarText(selected) + '},"type":"object"}'
      : field === "example" ? '{"example":' + literalRefText(decoyRef) + ',"type":' + JSON.stringify(selected) + '}'
      : '{"type":' + JSON.stringify(selected) + ',"x-data":' + literalRefText(decoyRef) + '}'),
  });
  rows.push({
    name: "literal-alias-spellings",
    input: selected => ({ schema: { type: selected, example: {
      encoded: "#%2Fcomponents%2Fschemas%2F_ttsc_schema_reference_0",
      plain: "#/components/schemas/_ttsc_schema_reference_0",
    } } }),
    expected: selected => postText('{"example":{"encoded":"#%2Fcomponents%2Fschemas%2F_ttsc_schema_reference_0",' +
      '"plain":"#/components/schemas/_ttsc_schema_reference_0"},"type":' + JSON.stringify(selected) + '}'),
  });
  for (const [name, spelling] of [
    ["literal-private-alias-ref", "#/components/schemas/_ttsc_schema_reference_0"],
    ["literal-encoded-private-alias-ref", "#%2Fcomponents%2Fschemas%2F_ttsc_schema_reference_0"],
  ] as const) rows.push({
    name,
    input: () => ({ schema: { $ref: target, example: ref(spelling) } }),
    expected: selected => postText('{"example":' + literalRefText(spelling) +
      ',"type":' + JSON.stringify(selected) + '}'),
  });
  const parameter = { name: "q", in: "query", schema: ref(encoded) };
  const parameterText = (selected: string): string => '{"parameters":[{"in":"query","name":"q","schema":' +
    scalarText(selected) + '}],"responses":{"200":{"description":"OK"}}}';
  rows.push(
    { name: "operation-parameter", input: () => ({ operation: { parameters: [parameter], responses: ok } }), expected: parameterText },
    { name: "path-parameter", input: () => ({ pathParameters: [parameter], operation: { responses: ok } }), expected: parameterText },
    { name: "component-parameter", input: () => ({ components: { parameters: { Q: parameter } },
      operation: { parameters: [ref("#/components/parameters/Q")], responses: ok } }), expected: parameterText },
    { name: "component-request-body", input: () => ({ components: { requestBodies: { B: post(ref(encoded)).requestBody } },
      operation: { requestBody: ref("#/components/requestBodies/B"), responses: ok } }), expected: selected => postText(scalarText(selected)) },
  );
  const responseText = (selected: string): string => '{"responses":{"200":{"content":{"application/json":{"schema":' +
    scalarText(selected) + '}},"description":"OK"}}}';
  rows.push(
    { name: "response-content", input: () => ({ operation: { responses: { "200": {
      description: "OK", content: { "application/json": { schema: ref(encoded) } },
    } } } }), expected: responseText },
    { name: "component-response", input: () => ({ components: { responses: { R: {
      description: "OK", content: { "application/json": { schema: ref(encoded) } },
    } } }, operation: { responses: { "200": ref("#/components/responses/R") } } }), expected: responseText },
  );
  const headerText = (selected: string): string => '{"responses":{"200":{"description":"OK","headers":{"X":' +
    '{"in":"header","name":"X","schema":' + scalarText(selected) + '}}}}}';
  rows.push(
    { name: "response-header", input: () => ({ operation: { responses: { "200": {
      description: "OK", headers: { X: { schema: ref(encoded) } },
    } } } }), expected: headerText },
    { name: "component-header", input: () => ({ components: { headers: { H: { schema: ref(encoded) } } },
      operation: { responses: { "200": { description: "OK", headers: { X: ref("#/components/headers/H") } } } } }), expected: headerText },
    { name: "media-itemSchema", version: "3.2.0", input: () => ({ operation: {
      requestBody: { content: { "application/json-seq": { itemSchema: ref(encoded) } } }, responses: ok,
    } }), expected: selected => '{"requestBody":{"content":{"application/json-seq":{"itemSchema":' +
      scalarText(selected) + '}}},"responses":{"200":{"description":"OK"}}}' },
    { name: "additional-operation", input: () => ({ custom: true, operation: post(ref(encoded)) }), expected: selected => postText(scalarText(selected)) },
  );
  const root = TestProject.tmpdir("swagger-raw-provenance-");
  const failures: Error[] = [];
  const check = (label: string, operation: () => void): void => {
    try { operation(); } catch (cause) { failures.push(new Error(label, { cause })); }
  };
  const hash = (text: string): string => createHash("sha256").update(text).digest("hex");
  const sibling = hash('{"responses":{"200":{"description":"OK"}}}');
  try {
    for (const version of ["3.1.0", "3.2.0"] as const) {
      for (const row of rows) {
        if (row.version !== undefined && row.version !== version) continue;
        let baseline: string | undefined;
        for (const [variant, selected, decoy, clutter] of [
          ["baseline", "string", "boolean", false],
          ["selected-edit", "number", "boolean", false],
          ["decoy-edit", "string", "integer", false],
          ["unrelated-additions", "string", "boolean", true],
        ] as const) {
          const label = version + ":" + row.name + ":" + variant;
          try {
            const input = row.input(selected, decoy);
            const operation = input.operation ?? post(input.schema);
            const customKey = version === "3.1.0" ? "x-additionalOperations" : "additionalOperations";
            const selectedPath = {
              ...(input.pathParameters === undefined ? {} : { parameters: input.pathParameters }),
              ...(input.custom ? { [customKey]: { REPORT: operation } } : { post: operation }),
            };
            const source = label.replaceAll(":", "-") + ".json";
            fs.writeFileSync(path.join(root, source), JSON.stringify({
              openapi: version, info: { title: "Raw provenance", version: "1" },
              paths: { "/selected": selectedPath, "/sibling": { get: { responses: ok } } },
              components: { ...input.components, schemas: {
                ...(clutter ? { Unrelated: { oneOf: [ref(target), scalar("null")] } } : {}),
                Target: scalar(selected), Decoy: scalar(decoy),
                ...input.schemas,
              } },
              ...(clutter ? { webhooks: { untouched: { post: post(ref(encoded)) } } } : {}),
            }));
            const result = await loadSwaggerOperations({ root, sources: [source] });
            assert.deepEqual(result.problems, [], label);
            assert.equal(result.documents.length, 1, label);
            const operations = result.documents[0]!.operations;
            check(label + ":identities", () => assert.deepEqual(
              operations.map(value => [value.method, value.path]),
              [["GET", "/sibling"], [input.custom ? "REPORT" : "POST", "/selected"]],
            ));
            const actual = operations.find(value => value.path === "/selected")?.digest;
            if (row.expected !== undefined)
              check(label + ":selected", () => assert.equal(actual, hash(row.expected!(selected))));
            else if (variant === "baseline") {
              assert.equal(typeof actual, "string", label);
              baseline = actual;
            } else if (baseline !== undefined)
              check(label + ":unresolved-invariance", () => assert.equal(actual, baseline));
            check(label + ":sibling", () => assert.equal(
              operations.find(value => value.path === "/sibling")?.digest, sibling,
            ));
          } catch (cause) {
            failures.push(new Error(label + ":load", { cause }));
          }
        }
      }
    }
  } finally {
    check("cleanup:remove", () => fs.rmSync(root, { recursive: true, force: true }));
    check("cleanup:absence", () => assert.equal(fs.existsSync(root), false));
  }
  if (failures.length) throw new AggregateError(failures, "Raw Swagger reference provenance failed.");
}
