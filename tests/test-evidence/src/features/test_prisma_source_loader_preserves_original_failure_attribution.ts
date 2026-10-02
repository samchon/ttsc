import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { TestProject } from "../../../utils/src/TestProject";

/**
 * Verifies original Prisma rejected and unreadable inputs retain distinct attribution.
 *
 * Readable parser failures have byte identity; an unreadable set has none.
 * Location and terminal-clean text must survive the parser error conversion.
 *
 * 1. Load the original line-7 invalid default and unclosed model independently.
 * 2. Load the original missing-file request beside its unrelated readable schema.
 * 3. Assert rejection, line/escape boundaries and appropriate byte identity.
 * 4. Collect every input's failures and exact temporary-root cleanup failures.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual loadPrismaModels and the real parser/filesystem. The original invalid-default row requires zero documents, one problem, prisma/schema.prisma:7, no ESC or [1;91m, and independently framed byte digest. The original missing-file row requires one problem and empty digest; the original unclosed-model row requires rejection rather than successful empty payload. These preserve the T parts of the three native failure cases, not their G inventory wildcard or native hashing assertions.
 * @evidence contracts/testing.md#independent-expectations Original authored invalid/missing inputs establish rejection. Literal schema lines establish line 7, literal terminal escape exclusions establish plain diagnostics, and source path plus NUL plus SHA256 of exact raw bytes plus newline establishes readable-set identity independently of loader output. Missing bytes imply empty identity. No exact parser-version-dependent diagnostic text is claimed.
 * @evidence contracts/testing.md#distinguishing-cases Multi-line invalid default contrasts with an unclosed model and a never-created absent.prisma despite an unrelated schema.prisma existing. Exact original inputs differ from the VM UnknownType/open-failure matrix and are not certified by it. Successful populations remain in the original-set payload unit. Only the location row asserts exact location and ANSI exclusions.
 * @evidence contracts/testing.md#execution-ownership Matching src/features export invokes maintained TypeScript source, real file reads and WASM in the same unit process, without native producer, installed consumer or product child. Three independently prepared rows retain load/assertion labels and continue after failure. Exact invocation-root removal/absence errors are collected. Actual execution, selection and native inventory behavior remain separate verification.
 */
export async function test_prisma_source_loader_preserves_original_failure_attribution(): Promise<void> {
  const { loadPrismaModels } = createRequire(import.meta.url)(fileURLToPath(new URL(
    "../../../../packages/evidence/src/internal/loadPrismaModels.ts", import.meta.url,
  ))) as {
    loadPrismaModels(request: { root: string; sets: Array<{ id: string; files: string[] }> }): Promise<{
      documents: unknown[];
      problems: Array<{ message: string; digest: string }>;
    }>;
  };
  const root = TestProject.tmpdir("prisma-original-failure-attribution-");
  const failures: Error[] = [];
  const check = (label: string, operation: () => void): void => {
    try { operation(); } catch (cause) { failures.push(new Error(label, { cause })); }
  };
  const invalid = `datasource db {
  provider = "postgresql"
}

model Sale {
  id String @id
  price Int @default(
    0
  )
}
`;
  const unrelated = `datasource db {
  provider = "postgresql"
}

/// A sale.
model Sale {
  id        String @id @db.Uuid
  price     Int
  seller_id String @db.Uuid
  seller    Seller @relation(fields: [seller_id], references: [id])
}

model Seller {
  id    String @id @db.Uuid
  sales Sale[]
}
`;
  try {
    for (const [label, schema, source] of [
      ["invalid-location", invalid, "prisma/schema.prisma"],
      ["missing-file", unrelated, "prisma/absent.prisma"],
      ["unclosed-model", "model Sale {\n  id String @id\n", "prisma/schema.prisma"],
    ] as const) {
      try {
        const caseRoot = path.join(root, label);
        TestProject.writeFiles(caseRoot, { "prisma/schema.prisma": schema });
        const result = await loadPrismaModels({ root: caseRoot, sets: [{ id: label, files: [source] }] });
        check(label + ":no documents", () => assert.equal(result.documents.length, 0));
        check(label + ":one problem", () => assert.equal(result.problems.length, 1));
        const problem = result.problems[0];
        if (label === "invalid-location") {
          check(label + ":line", () => assert.ok(problem?.message.includes("prisma/schema.prisma:7")));
          check(label + ":no ESC", () => {
            assert.ok(problem);
            assert.equal(problem.message.includes("\u001b"), false);
            assert.equal(problem.message.includes("[1;91m"), false);
          });
          const rawHash = createHash("sha256").update(invalid).digest("hex");
          const expected = createHash("sha256").update("prisma/schema.prisma\u0000" + rawHash + "\n").digest("hex");
          check(label + ":byte digest", () => assert.equal(problem?.digest, expected));
        } else if (label === "missing-file")
          check(label + ":empty digest", () => assert.equal(problem?.digest, ""));
      } catch (cause) {
        failures.push(new Error(label + ":source load", { cause }));
      }
    }
  } finally {
    check("cleanup:remove", () => fs.rmSync(root, { recursive: true, force: true }));
    check("cleanup:absence", () => assert.equal(fs.existsSync(root), false));
  }
  if (failures.length) throw new AggregateError(failures, "Original Prisma failure attribution failed.");
}
