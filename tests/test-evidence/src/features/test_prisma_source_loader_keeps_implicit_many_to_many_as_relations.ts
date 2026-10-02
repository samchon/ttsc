import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { TestProject } from "../../../utils/src/TestProject";

/**
 * Verifies implicit many-to-many payloads contain only authored models and fields.
 *
 * Prisma's implicit join table must not introduce a model or foreign-key column
 * into this population. Both authored lists represent relations.
 *
 * 1. Parse the original Post/Category lists with no authored join table.
 * 2. Require exactly both models, their id columns and their list relations.
 * 3. Collect assertion and temporary-root cleanup failures.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual loadPrismaModels and the real parser. The exact table rejects implicit join models/columns, dropped neighbors or list fields treated as columns, preserving the source payload meaning of TestPrismaImplicitManyToManyMaterializesRelationsOnly. Native unit materialization is separately owned.
 * @evidence contracts/testing.md#independent-expectations The original literal Post/Category schema independently names two models, two id columns and two relation lists. The expected table is not derived from parser output and admits no un-authored join member.
 * @evidence contracts/testing.md#distinguishing-cases List relations on both sides with no scalar foreign keys distinguish implicit many-to-many from the explicit one-to-many fixture. Exact whole payload equality rejects extra join columns as well as incorrect field kinds. Explicit join-table semantics are not asserted here.
 * @evidence contracts/testing.md#execution-ownership Matching src/features export calls maintained source and its WASM parser in the same unit Node process over one temporary schema. It installs no consumer, builds no native artifact and launches no product child. Admission gates the table; table and exact-root cleanup failures are collected. Actual runtime and census remain unverified until separately executed.
 */
export async function test_prisma_source_loader_keeps_implicit_many_to_many_as_relations(): Promise<void> {
  const { loadPrismaModels } = createRequire(import.meta.url)(fileURLToPath(new URL(
    "../../../../packages/evidence/src/internal/loadPrismaModels.ts", import.meta.url,
  ))) as {
    loadPrismaModels(request: { root: string; sets: Array<{ id: string; files: string[] }> }): Promise<{
      documents: Array<{ models: Array<{ name: string; fields: Array<{ name: string; symbol: string }> }> }>;
      problems: unknown[];
    }>;
  };
  const root = TestProject.tmpdir("prisma-original-many-to-many-");
  const failures: Error[] = [];
  const check = (label: string, operation: () => void): void => {
    try { operation(); } catch (cause) { failures.push(new Error(label, { cause })); }
  };
  try {
    TestProject.writeFiles(root, { "prisma/schema.prisma": `datasource db {
  provider = "postgresql"
}

model Post {
  id         String     @id @db.Uuid
  categories Category[]
}

model Category {
  id    String @id @db.Uuid
  posts Post[]
}
` });
    const result = await loadPrismaModels({ root, sets: [{ id: "many-to-many", files: ["prisma/schema.prisma"] }] });
    assert.deepEqual(result.problems, []);
    assert.equal(result.documents.length, 1);
    check("exact authored models and fields", () => assert.deepEqual(
      result.documents[0]!.models.map(model => [model.name, model.fields.map(field => [field.name, field.symbol])]),
      [["Post", [["id", "column"], ["categories", "relation"]]], ["Category", [["id", "column"], ["posts", "relation"]]]],
    ));
  } catch (cause) {
    failures.push(new Error("many-to-many source load", { cause }));
  } finally {
    check("cleanup:remove", () => fs.rmSync(root, { recursive: true, force: true }));
    check("cleanup:absence", () => assert.equal(fs.existsSync(root), false));
  }
  if (failures.length) throw new AggregateError(failures, "Implicit Prisma many-to-many payload failed.");
}
