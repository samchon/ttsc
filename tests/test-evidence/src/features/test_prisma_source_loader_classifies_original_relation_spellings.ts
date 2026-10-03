import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { TestProject } from "../../../utils/src/TestProject";

/**
 * Verifies optional, list and required action-bearing relations share one kind.
 *
 * The original three-model fixture includes required Cascade and optional
 * SetNull relations. Foreign-key scalars must remain columns beside them.
 *
 * 1. Parse the original User, Order and line declarations.
 * 2. Require the complete literal model/field classification table.
 * 3. Collect assertion and temporary-root cleanup failures.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual loadPrismaModels and its real parser. The whole model/own-field table preserves TestPrismaClassifiesEveryRelationSpelling: all list, optional and required onDelete fields are relations and all ids/foreign keys are columns. Native prismaModelUnits remains separately owned.
 * @evidence contracts/testing.md#independent-expectations Literal User/Order/line declarations establish the independent complete payload table. Expected fields and kinds are authored, not obtained from parser output or native unit projection.
 * @evidence contracts/testing.md#distinguishing-cases Optional owner with SetNull contrasts with required order with Cascade, list orders/lines and their foreign-key scalars. The complete table rejects dropped or extra fields and any misclassification. Existing Sale/Seller coverage lacks the original required Cascade arm and is not counted as its survivor.
 * @evidence contracts/testing.md#execution-ownership The matching feature calls maintained TypeScript source and WASM in the same unit process over one temporary schema. No installed consumer, native build or product child is involved. Admission gates the table; assertion and exact-root removal/absence failures are collected. Runtime and exact selection remain separate verification.
 */
export async function test_prisma_source_loader_classifies_original_relation_spellings(): Promise<void> {
  const { loadPrismaModels } = createRequire(import.meta.url)(fileURLToPath(new URL(
    "../../../../packages/evidence/src/internal/loadPrismaModels.ts", import.meta.url,
  ))) as {
    loadPrismaModels(request: { root: string; sets: Array<{ id: string; files: string[] }> }): Promise<{
      documents: Array<{ models: Array<{ name: string; fields: Array<{ name: string; symbol: string }> }> }>;
      problems: unknown[];
    }>;
  };
  const root = TestProject.tmpdir("prisma-original-relations-");
  const failures: Error[] = [];
  const check = (label: string, operation: () => void): void => {
    try { operation(); } catch (cause) { failures.push(new Error(label, { cause })); }
  };
  try {
    TestProject.writeFiles(root, { "prisma/schema.prisma": `datasource db {
  provider = "postgresql"
}

model User {
  id     String  @id @db.Uuid
  orders Order[]
}

model Order {
  id       String  @id @db.Uuid
  owner_id String? @db.Uuid
  owner    User?   @relation(fields: [owner_id], references: [id], onDelete: SetNull)
  lines    line[]
}

model line {
  id       String @id @db.Uuid
  order_id String @db.Uuid
  order    Order  @relation(fields: [order_id], references: [id], onDelete: Cascade)
}
` });
    const result = await loadPrismaModels({ root, sets: [{ id: "relations", files: ["prisma/schema.prisma"] }] });
    assert.deepEqual(result.problems, []);
    assert.equal(result.documents.length, 1);
    check("complete model/field kinds", () => assert.deepEqual(
      result.documents[0]!.models.map(model => [model.name, model.fields.map(field => [field.name, field.symbol])]),
      [
        ["User", [["id", "column"], ["orders", "relation"]]],
        ["Order", [["id", "column"], ["owner_id", "column"], ["owner", "relation"], ["lines", "relation"]]],
        ["line", [["id", "column"], ["order_id", "column"], ["order", "relation"]]],
      ],
    ));
  } catch (cause) {
    failures.push(new Error("relation source load", { cause }));
  } finally {
    check("cleanup:remove", () => fs.rmSync(root, { recursive: true, force: true }));
    check("cleanup:absence", () => assert.equal(fs.existsSync(root), false));
  }
  if (failures.length) throw new AggregateError(failures, "Original Prisma relation spellings failed.");
}
