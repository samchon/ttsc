import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { TestProject } from "../../../utils/src/TestProject";

/**
 * Verifies the original scaffold parses cleanly without models and the first model survives.
 *
 * Generator and datasource blocks alone produce a healthy empty model payload.
 * A real model produces a model and column without any parser-config toggle.
 * Native activation and missing-reference diagnostics use those results later.
 *
 * 1. Load the exact two-generator SQLite scaffold at its original source path.
 * 2. Independently load the original target model and id column.
 * 3. Require clean single-document payloads with the respective literal tables.
 * 4. Collect both rows' failures and exact temporary-root cleanup failures.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual loadPrismaModels and the real parser with emptyPrismaScaffold from TestPrismaClaimWithOnlyTheBenchmarkScaffoldIsInactive and target from TestFirstSelectedPrismaModelActivatesCoverage. Each row requires no problems and one document; the scaffold has zero models and the target payload has exactly target with id classified as column. It does not invoke native claim activation or graphRule.Check.
 * @evidence contracts/testing.md#independent-expectations Original literal scaffold contains two generators and a SQLite datasource but no model declaration. The original model target/id schema independently establishes the positive model/column table. Expected models are authored, not generated from parser output or a fake empty inventory.
 * @evidence contracts/testing.md#distinguishing-cases Healthy model-free scaffold contrasts with a clean first-model population, so rejecting the scaffold or always returning no models fails. Exact prisma/schema/main.prisma and model.prisma inputs are preserved. Consumer one-generator scaffolds are not claimed identical; hidden units, failed own populations and other artifact activation cases remain separate.
 * @evidence contracts/testing.md#execution-ownership Matching feature invokes maintained TypeScript source and WASM in the same unit Node process over two independently named file-set requests. It installs no consumer, builds no native artifact and starts no product child. Both rows continue independently after failure, with admission gating their own table assertions. Exact tracked-root removal/absence errors are collected. Cold native-cache misses, JSON transport, product failed flags and activation diagnostics are separate G/E assertions; runtime/census need independent verification.
 */
export async function test_prisma_source_loader_distinguishes_original_scaffold_and_first_model(): Promise<void> {
  const { loadPrismaModels } = createRequire(import.meta.url)(fileURLToPath(new URL(
    "../../../../packages/evidence/src/internal/loadPrismaModels.ts", import.meta.url,
  ))) as {
    loadPrismaModels(request: { root: string; sets: Array<{ id: string; files: string[] }> }): Promise<{
      documents: Array<{ models: Array<{ name: string; fields: Array<{ name: string; symbol: string }> }> }>;
      problems: unknown[];
    }>;
  };
  const root = TestProject.tmpdir("prisma-original-scaffold-model-");
  const failures: Error[] = [];
  const check = (label: string, operation: () => void): void => {
    try { operation(); } catch (cause) { failures.push(new Error(label, { cause })); }
  };
  try {
    TestProject.writeFiles(root, {
      "prisma/schema/main.prisma": `generator client {
  provider     = "prisma-client"
  output       = "../../src/prisma"
  moduleFormat = "cjs"
}

datasource db {
  provider = "sqlite"
}

generator markdown {
  provider = "prisma-markdown"
  output   = "../../../../docs/ERD.md"
}
`,
      "prisma/schema/model.prisma": "model target {\n  id String @id\n}\n",
    });
    for (const [label, source] of [
      ["model-free-scaffold", "prisma/schema/main.prisma"],
      ["first-model", "prisma/schema/model.prisma"],
    ] as const) {
      try {
        const result = await loadPrismaModels({ root, sets: [{ id: label, files: [source] }] });
        assert.deepEqual(result.problems, [], label);
        assert.equal(result.documents.length, 1, label);
        check(label + ":payload", () => assert.deepEqual(
          result.documents[0]!.models.map(model => [model.name, model.fields.map(field => [field.name, field.symbol])]),
          label === "model-free-scaffold" ? [] : [["target", [["id", "column"]]]],
        ));
      } catch (cause) {
        failures.push(new Error(label + ":source load", { cause }));
      }
    }
  } catch (cause) {
    failures.push(new Error("scaffold/model preparation", { cause }));
  } finally {
    check("cleanup:remove", () => fs.rmSync(root, { recursive: true, force: true }));
    check("cleanup:absence", () => assert.equal(fs.existsSync(root), false));
  }
  if (failures.length) throw new AggregateError(failures, "Original Prisma scaffold/model admission failed.");
}
