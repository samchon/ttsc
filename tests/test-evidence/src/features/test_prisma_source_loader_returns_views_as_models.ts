import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { TestProject } from "../../../utils/src/TestProject";

/**
 * Verifies the Prisma source parser returns a view as a model with a column.
 *
 * A view's different declaration spelling must not exclude it from the model
 * payload. The neighboring ordinary model must remain available too.
 *
 * 1. Load the original views-enabled schema containing Sale and SaleSummary.
 * 2. Require both model payloads and SaleSummary.total classified as a column.
 * 3. Collect independent assertions and temporary-root cleanup failures.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual loadPrismaModels and its real WASM parser. Assertions detect a dropped view, a dropped ordinary model or total misclassified as a relation. Native prismaModelUnits and JSON transport are separate operations, not executed here.
 * @evidence contracts/testing.md#independent-expectations The literal schema preserves TestPrismaBridgeReturnsAViewAsAModel, including the views preview flag and projection comment. The independent expected names Sale/SaleSummary and total column preserve that case's assertions; its unasserted SaleSummary.id field is not claimed as inherited assertion coverage.
 * @evidence contracts/testing.md#distinguishing-cases One supported view contrasts with an ordinary model in the same schema. The view's scalar total field must survive as a column; excluding all non-model spellings or all view fields fails these checks. Enum exclusion and relation classification have their own direct unit cases.
 * @evidence contracts/testing.md#execution-ownership The matching feature export executes maintained TypeScript source and the parser in the same unit Node process over one temporary file. It installs no consumer, builds no native artifact and starts no product child. After admission, model and column checks collect independent failures; cleanup removes only its exact tracked root and records removal/absence errors. Actual execution and scanner census are not implied by this body.
 */
export async function test_prisma_source_loader_returns_views_as_models(): Promise<void> {
  const { loadPrismaModels } = createRequire(import.meta.url)(fileURLToPath(new URL(
    "../../../../packages/evidence/src/internal/loadPrismaModels.ts", import.meta.url,
  ))) as {
    loadPrismaModels(request: { root: string; sets: Array<{ id: string; files: string[] }> }): Promise<{
      documents: Array<{ id: string; models: Array<{ name: string; fields: Array<{ name: string; symbol: string }> }> }>;
      problems: unknown[];
    }>;
  };
  const root = TestProject.tmpdir("prisma-view-source-");
  const failures: Error[] = [];
  const check = (label: string, operation: () => void): void => {
    try { operation(); } catch (cause) { failures.push(new Error(label, { cause })); }
  };
  try {
    TestProject.writeFiles(root, { "prisma/schema.prisma": `datasource db {
  provider = "postgresql"
}

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["views"]
}

model Sale {
  id String @id @db.Uuid
}

/// A projection.
view SaleSummary {
  id    String @unique
  total Int
}
` });
    const result = await loadPrismaModels({ root, sets: [{ id: "views", files: ["prisma/schema.prisma"] }] });
    assert.deepEqual(result.problems, []);
    assert.equal(result.documents.length, 1);
    const document = result.documents[0]!;
    check("set identity", () => assert.equal(document.id, "views"));
    check("ordinary model", () => assert.ok(document.models.some(model => model.name === "Sale")));
    check("view model", () => assert.ok(document.models.some(model => model.name === "SaleSummary")));
    check("view total column", () => assert.equal(
      document.models.find(model => model.name === "SaleSummary")?.fields.find(field => field.name === "total")?.symbol,
      "column",
    ));
  } catch (cause) {
    failures.push(new Error("view source load", { cause }));
  } finally {
    check("cleanup:remove", () => fs.rmSync(root, { recursive: true, force: true }));
    check("cleanup:absence", () => assert.equal(fs.existsSync(root), false));
  }
  if (failures.length) throw new AggregateError(failures, "Prisma view payload distinctions failed.");
}
