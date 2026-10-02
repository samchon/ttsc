import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { TestProject } from "../../../utils/src/TestProject";

/**
 * Verifies the original mixed Swagger request answers every source independently.
 *
 * Rejected or absent sources must not hide valid documents in the same request.
 * A reached member schema edit must move its operation while the independent
 * sale operation retains its digest.
 *
 * 1. Submit the original five source names in one actual loader request.
 * 2. Require three documents, two problems and one correct outcome per source.
 * 3. Check readable byte identities, missing identity and actionable rejection.
 * 4. Check both original operation digests and collect cleanup failures.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual loadSwaggerOperations once with swagger.json, broken.json, absent.json, before.json and after.json from TestSwaggerBridgeAnswersEverySourceInOneRequest. Each source's exact multiplicity and successful/rejected class, readable raw-byte hashes, unreadable empty hash and rejection reason are asserted. Both before/after POST:/members and POST:/sales must exist with nonempty unique operation digests before reached-schema movement and unrelated-schema stability are compared.
 * @evidence contracts/testing.md#independent-expectations Exact original source bytes and never-created absent.json establish outcomes and independently computed raw SHA256 identities. Authored IMember string/number versus unchanged ISale independently establishes moved/stable relations; those comparisons do not certify exact operation-hash encoding. Node/native digest equality and actual JSON transport retain separate G/E owners.
 * @evidence contracts/testing.md#distinguishing-cases One request combines readable success, readable unsupported 4.0 rejection, missing file and the original two raw 3.1 DTO variants with required properties. Unique per-source outcomes exclude duplicates and foreign sources. The existing GET sibling and malformed-operation fixtures do not preserve these exact POST/ISale and unsupported-version inputs. The separate raw provenance 336-load entry remains unchanged and is not this batch's execution evidence.
 * @evidence contracts/testing.md#execution-ownership Matching src/features export directly invokes maintained TypeScript source, real YAML/conversion and file reads in this same unit Node process, without installation, native build or product child. A single five-source request owns the actual loads; independent checks continue after any source failure, and a missing prerequisite blocks only its operation comparison. Named cleanup errors remove only this invocation's tracked root. Runtime and exact census must be verified separately.
 */
export async function test_swagger_source_loader_preserves_original_mixed_batch(): Promise<void> {
  type Document = { source: string; digest: string; operations: Array<{ method: string; path: string; digest: string }> };
  const { loadSwaggerOperations } = await import(new URL(
    "../../../../packages/evidence/src/internal/loadSwaggerOperations.ts", import.meta.url,
  ).href) as {
    loadSwaggerOperations(request: { root: string; sources: string[] }): Promise<{
      documents: Document[];
      problems: Array<{ source: string; message: string; digest: string }>;
    }>;
  };
  const document = (memberType: string): string =>
    `{"openapi":"3.1.0","info":{"title":"A","version":"1"},"paths":{
      "/members":{"post":{"requestBody":{"content":{"application/json":{"schema":{"$ref":"#/components/schemas/IMember"}}}},"responses":{"200":{"description":"OK"}}}},
      "/sales":{"post":{"requestBody":{"content":{"application/json":{"schema":{"$ref":"#/components/schemas/ISale"}}}},"responses":{"200":{"description":"OK"}}}}
    },"components":{"schemas":{
      "IMember":{"type":"object","properties":{"name":{"type":"` + memberType + `"}},"required":["name"]},
      "ISale":{"type":"object","properties":{"price":{"type":"number"}},"required":["price"]}
    }}}`;
  const bytes = {
    "swagger.json": '{"openapi":"3.1.0","info":{"title":"B","version":"1"},"paths":{"/members":{"post":{"responses":{"200":{"description":"OK"}}}}}}',
    "broken.json": '{"openapi":"4.0.0","info":{"title":"B","version":"1"},"paths":{}}',
    "before.json": document("string"),
    "after.json": document("number"),
  };
  const root = TestProject.tmpdir("swagger-original-mixed-batch-");
  const failures: Error[] = [];
  const check = (label: string, operation: () => void): boolean => {
    try { operation(); return true; }
    catch (cause) { failures.push(new Error(label, { cause })); return false; }
  };
  try {
    TestProject.writeFiles(root, bytes);
    const result = await loadSwaggerOperations({
      root, sources: ["swagger.json", "broken.json", "absent.json", "before.json", "after.json"],
    });
    check("population:documents", () => assert.equal(result.documents.length, 3));
    check("population:problems", () => assert.equal(result.problems.length, 2));
    const expected = new Map([
      ["swagger.json", true], ["before.json", true], ["after.json", true],
      ["broken.json", false], ["absent.json", false],
    ]);
    for (const [source, succeeds] of expected) {
      check(source + ":document multiplicity", () => assert.equal(
        result.documents.filter(value => value.source === source).length, succeeds ? 1 : 0,
      ));
      check(source + ":problem multiplicity", () => assert.equal(
        result.problems.filter(value => value.source === source).length, succeeds ? 0 : 1,
      ));
    }
    for (const value of [...result.documents, ...result.problems])
      check(value.source + ":known source", () => assert.ok(expected.has(value.source)));
    for (const source of ["swagger.json", "broken.json"] as const) {
      const outcomes = [...result.documents, ...result.problems].filter(value => value.source === source);
      check(source + ":byte identity", () => {
        assert.equal(outcomes.length, 1);
        assert.equal(outcomes[0]!.digest, createHash("sha256").update(bytes[source]).digest("hex"));
      });
    }
    check("broken.json:reason", () => assert.ok(
      result.problems.find(value => value.source === "broken.json")?.message.trim(),
    ));
    check("absent.json:empty identity", () => assert.equal(
      result.problems.find(value => value.source === "absent.json")?.digest, "",
    ));
    const operationDigests = (source: string): Map<string, string> | undefined => {
      const documents = result.documents.filter(value => value.source === source);
      const ready = check(source + ":digest admission", () => {
        assert.equal(documents.length, 1);
        assert.equal(result.problems.filter(value => value.source === source).length, 0);
      });
      if (!ready) return undefined;
      const digests = new Map<string, string>();
      let valid = true;
      for (const operation of documents[0]!.operations) {
        const key = operation.method.toUpperCase() + ":" + operation.path;
        if (!check(source + ":" + key + ":nonempty unique", () => {
          assert.equal(typeof operation.digest, "string");
          assert.notEqual(operation.digest, "");
          assert.equal(digests.has(key), false);
        })) valid = false;
        digests.set(key, operation.digest);
      }
      for (const key of ["POST:/members", "POST:/sales"])
        if (!check(source + ":" + key + ":required", () => assert.ok(digests.get(key)))) valid = false;
      return valid ? digests : undefined;
    };
    const before = operationDigests("before.json");
    const after = operationDigests("after.json");
    if (before && after) {
      check("POST:/members:reached schema changed", () => assert.notEqual(before.get("POST:/members"), after.get("POST:/members")));
      check("POST:/sales:unrelated schema stable", () => assert.equal(before.get("POST:/sales"), after.get("POST:/sales")));
    }
  } catch (cause) {
    failures.push(new Error("mixed source request", { cause }));
  } finally {
    check("cleanup:remove", () => fs.rmSync(root, { recursive: true, force: true }));
    check("cleanup:absence", () => assert.equal(fs.existsSync(root), false));
  }
  if (failures.length) throw new AggregateError(failures, "Original mixed Swagger batch failed.");
}
