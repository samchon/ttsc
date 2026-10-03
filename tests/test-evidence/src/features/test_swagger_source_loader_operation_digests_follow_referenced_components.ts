import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestProject } from "../../../utils/src/TestProject";

/**
 * Verifies a Swagger operation digest follows the components it references and
 * ignores how the document was written.
 *
 * An operation is often only a `$ref` to a request DTO, so a digest over the
 * operation as written would not move when the DTO changes. The digest must
 * also stay put when only key order differs, and malformed operations must be
 * reported as source problems without hiding the other documents of the request.
 *
 * 1. Load one authored document and require its two operations in sorted order.
 * 2. Edit a referenced schema, an unrelated operation, key order and a recursive
 *    schema one at a time and compare each operation's digest with the baseline.
 * 3. Load a path without a leading slash and a duplicated operation beside a
 *    healthy document and require attributed problems with the healthy one kept.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the authored loadSwaggerOperations source API on real files. A digest that covered only the written operation would not move when its referenced DTO changes, and a digest that covered the whole document would move for the unrelated sibling; both fail an assertion below.
 * @evidence contracts/testing.md#independent-expectations Operation identities, ordering and which operation must or must not move follow from the authored documents and the contract that an operation owns what it references. Digests are compared relationally and no hash value is computed from the implementation.
 * @evidence contracts/testing.md#distinguishing-cases The referenced-schema edit is the positive arm for POST and the negative arm for GET; the description edit is the converse. Reordered keys must leave both unchanged, a self-referencing schema must load and still distinguish an edit beneath it, and the path and duplicate-method documents are the malformed boundaries.
 * @evidence contracts/testing.md#execution-ownership The matching src/features export is discovered by test-evidence's runner and central function claim. It imports the maintained loader source and reads temporary files in the same Node process, installing no consumer and starting no compiler, Go host or product process. Each load records its own failure and leaves independent variants and malformed-source cases executable; comparisons blocked by a failed load are not treated as coverage.
 */
export async function test_swagger_source_loader_operation_digests_follow_referenced_components(): Promise<void> {
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
        operations: Array<{ method: string; path: string; digest: string }>;
      }>;
      problems: Array<{ source: string; message: string }>;
    }>;
  };
  const ok = { "200": { description: "OK" } };
  const schemaOf = (type: string, extra: Record<string, unknown> = {}) => ({
    IMember: { type: "object", properties: { name: { type }, ...extra } },
  });
  const post = (reference: string = "#/components/schemas/IMember") => ({
    requestBody: {
      content: { "application/json": { schema: { $ref: reference } } },
    },
    responses: ok,
  });
  const document = (
    schemas: Record<string, unknown>,
    sales: Record<string, unknown> = { responses: ok },
  ) => ({
    openapi: "3.1.0",
    info: { title: "Digests", version: "1.0.0" },
    paths: { "/members": { post: post() }, "/sales": { get: sales } },
    components: { schemas },
  });

  const root = TestProject.tmpdir("evidence-swagger-digest-");
  const failures: unknown[] = [];
  const check = (run: () => void): void => {
    try {
      run();
    } catch (error) {
      failures.push(error);
    }
  };
  const load = async (
    name: string,
    value: unknown,
  ): Promise<Record<string, string> | undefined> => {
    try {
      fs.writeFileSync(path.join(root, name), JSON.stringify(value));
      const result = await loadSwaggerOperations({ root, sources: [name] });
      assert.deepEqual(result.problems, [], name);
      assert.equal(result.documents.length, 1, name);
      return Object.fromEntries(
        result.documents[0]!.operations.map((operation) => [
          `${operation.method} ${operation.path}`,
          operation.digest,
        ]),
      );
    } catch (cause) {
      failures.push(new Error(`Swagger digest input failed: ${name}`, { cause }));
      return undefined;
    }
  };
  try {
    const baseline = await load("baseline.json", document(schemaOf("string")));
    if (baseline) check(() =>
      assert.deepEqual(Object.keys(baseline), ["GET /sales", "POST /members"]),
    );

    const retyped = await load("retyped.json", document(schemaOf("number")));
    if (retyped && baseline) check(() =>
      assert.notEqual(
        retyped["POST /members"],
        baseline["POST /members"],
        "an edit to the referenced schema must move the operation that references it",
      ),
    );
    if (retyped && baseline) check(() =>
      assert.equal(
        retyped["GET /sales"],
        baseline["GET /sales"],
        "an edit to a schema the operation does not reference must leave it unchanged",
      ),
    );

    const described = await load(
      "described.json",
      document(schemaOf("string"), {
        responses: { "200": { description: "Changed" } },
      }),
    );
    if (described && baseline) check(() =>
      assert.notEqual(described["GET /sales"], baseline["GET /sales"]),
    );
    if (described && baseline) check(() =>
      assert.equal(described["POST /members"], baseline["POST /members"]),
    );

    // The same document with every object's keys written in the opposite order.
    const reversed = (value: unknown): unknown =>
      Array.isArray(value)
        ? value.map(reversed)
        : value !== null && typeof value === "object"
          ? Object.fromEntries(
              Object.entries(value).reverse().map(([key, child]) => [
                key,
                reversed(child),
              ]),
            )
          : value;
    const reordered = await load(
      "reordered.json",
      reversed(document(schemaOf("string"))),
    );
    if (reordered && baseline) check(() => assert.deepEqual(reordered, baseline));

    const recursive = (type: string) =>
      schemaOf(type, { parent: { $ref: "#/components/schemas/IMember" } });
    const cyclic = await load("cyclic.json", document(recursive("string")));
    const cyclicEdited = await load(
      "cyclic-edited.json",
      document(recursive("number")),
    );
    if (cyclicEdited && cyclic) check(() =>
      assert.notEqual(
        cyclicEdited["POST /members"],
        cyclic["POST /members"],
        "a self-referencing schema must still distinguish an edit beneath it",
      ),
    );

    fs.writeFileSync(
      path.join(root, "no-slash.json"),
      JSON.stringify({
        ...document(schemaOf("string")),
        paths: { members: { get: { responses: ok } } },
      }),
    );
    fs.writeFileSync(
      path.join(root, "duplicate.json"),
      JSON.stringify({
        ...document(schemaOf("string")),
        paths: {
          "/members": {
            get: { responses: ok },
            additionalOperations: { GET: { responses: ok } },
          },
        },
      }),
    );
    const mixed = await loadSwaggerOperations({
      root,
      sources: ["baseline.json", "no-slash.json", "duplicate.json"],
    });
    check(() =>
      assert.deepEqual(
        mixed.documents.map((value) => value.source),
        ["baseline.json"],
      ),
    );
    const problem = (source: string) =>
      mixed.problems.find((value) => value.source === source)?.message;
    check(() =>
      assert.equal(
        problem("no-slash.json"),
        "OpenAPI path 'members' must start with '/' to form an operation target",
      ),
    );
    check(() =>
      assert.equal(
        problem("duplicate.json"),
        "OpenAPI operation 'GET /members' is declared more than once",
      ),
    );
  } catch (error) {
    failures.push(error);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    check(() => assert.equal(fs.existsSync(root), false));
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1)
    throw new AggregateError(failures, "Swagger operation digest cases failed.");
}
