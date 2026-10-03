import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { TestProject } from "../../../utils/src/TestProject";

/**
 * Verifies an enum produces no model payload and leaves neighboring fields intact.
 *
 * An enum between two models must not become a model or attach its values to
 * the preceding model. Its use as a field type still represents a column.
 *
 * 1. Load the original Sale, SaleStatus and Seller schema through the source API.
 * 2. Require exactly the two models and their own column fields.
 * 3. Collect payload and cleanup failures before reporting them.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual loadPrismaModels and its real WASM parser in this process. The exact model/field table rejects enum/value payloads, misplaced ACTIVE/CLOSED members and status classified as a relation. Native unit materialization and JSON transport retain separate owners.
 * @evidence contracts/testing.md#independent-expectations The literal schema and table preserve TestPrismaEnumMaterializesNoUnit: Sale owns id/status, Seller owns id, all three fields are columns, and SaleStatus/ACTIVE/CLOSED are not models or fields. Expectations are not derived from parser output or Go materialization.
 * @evidence contracts/testing.md#distinguishing-cases A documented enum between two ordinary models contrasts excluded declarations with supported neighbors; the enum-typed status is the positive column case. Exact model and field arrays detect both missing neighbors and extra enum/value payloads. Relation and multi-file cases remain in the existing classification test.
 * @evidence contracts/testing.md#execution-ownership This matching src/features export calls maintained TypeScript source and the parser in the unit runner's Node process over one temporary schema. No installation, native build or product child is started. Admission blocks only dependent payload checks; exact temporary-root removal and absence failures are collected separately. Runtime and Evidence census remain separate verification steps.
 */
export async function test_prisma_source_loader_excludes_enums_and_preserves_neighbor_models(): Promise<void> {
  const { loadPrismaModels } = createRequire(import.meta.url)(fileURLToPath(new URL(
    "../../../../packages/evidence/src/internal/loadPrismaModels.ts", import.meta.url,
  ))) as {
    loadPrismaModels(request: { root: string; sets: Array<{ id: string; files: string[] }> }): Promise<{
      documents: Array<{ id: string; models: Array<{ name: string; fields: Array<{ name: string; symbol: string }> }> }>;
      problems: unknown[];
    }>;
  };
  const root = TestProject.tmpdir("prisma-enum-source-");
  const failures: Error[] = [];
  const check = (label: string, operation: () => void): void => {
    try { operation(); } catch (cause) { failures.push(new Error(label, { cause })); }
  };
  try {
    TestProject.writeFiles(root, { "schema.prisma": `datasource db {
  provider = "postgresql"
}

model Sale {
  id     String     @id @db.Uuid
  status SaleStatus
}

/// The set of sale states.
enum SaleStatus {
  ACTIVE
  CLOSED
}

model Seller {
  id String @id @db.Uuid
}
` });
    const result = await loadPrismaModels({ root, sets: [{ id: "enum", files: ["schema.prisma"] }] });
    assert.deepEqual(result.problems, []);
    assert.equal(result.documents.length, 1);
    check("set identity", () => assert.equal(result.documents[0]!.id, "enum"));
    check("models and own fields", () => assert.deepEqual(
      result.documents[0]!.models.map(model => [model.name, model.fields.map(field => [field.name, field.symbol])]),
      [["Sale", [["id", "column"], ["status", "column"]]], ["Seller", [["id", "column"]]]],
    ));
  } catch (cause) {
    failures.push(new Error("enum source load", { cause }));
  } finally {
    check("cleanup:remove", () => fs.rmSync(root, { recursive: true, force: true }));
    check("cleanup:absence", () => assert.equal(fs.existsSync(root), false));
  }
  if (failures.length) throw new AggregateError(failures, "Prisma enum payload distinctions failed.");
}
