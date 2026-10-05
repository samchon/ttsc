import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { TestProject } from "../../../utils/src/TestProject";

/**
 * Verifies a duplicate model across a Prisma set rejects that whole set.
 *
 * Two files belong to one model namespace. Silently merging the duplicate would
 * turn either file's declarations into a different contract.
 *
 * 1. Load the original two files, each declaring Sale, as one set.
 * 2. Require no successful document and one parser rejection naming Sale.
 * 3. Collect independent assertions and temporary-root cleanup failures.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual loadPrismaModels and its real parser with the two original fragments from TestPrismaDuplicateModelAcrossTheSetIsRejected. Zero documents, exactly one problem and Sale in its message distinguish rejection from silent merge or an unrelated failure.
 * @evidence contracts/testing.md#independent-expectations The literal fragments both declare Sale within one set, violating Prisma's unique model namespace. Expected rejection counts and duplicated name are independent of the loader output; no exact parser-version-dependent message is invented.
 * @evidence contracts/testing.md#distinguishing-cases Duplicate across two files is the negative multi-file case; the existing Sale/Seller classification unit supplies distinct models across files. Duplicate within one file is not asserted by this original case. No separate-file namespaces or parser recovery behavior is claimed.
 * @evidence contracts/testing.md#execution-ownership The matching feature calls maintained TypeScript source and the WASM parser in the same unit process, with two temporary inputs in one request. No installation, native build or actual product child occurs. Returned document/problem checks collect independent failures, as do exact-root removal/absence checks. Runtime and scanner census remain separate verification.
 */
export async function test_prisma_source_loader_rejects_original_duplicate_model_set(): Promise<void> {
  const { loadPrismaModels } = createRequire(import.meta.url)(
    fileURLToPath(
      new URL(
        "../../../../packages/evidence/src/internal/loadPrismaModels.ts",
        import.meta.url,
      ),
    ),
  ) as {
    loadPrismaModels(request: {
      root: string;
      sets: Array<{ id: string; files: string[] }>;
    }): Promise<{
      documents: unknown[];
      problems: Array<{ message: string }>;
    }>;
  };
  const root = TestProject.tmpdir("prisma-original-duplicate-");
  const failures: Error[] = [];
  const check = (label: string, operation: () => void): void => {
    try {
      operation();
    } catch (cause) {
      failures.push(new Error(label, { cause }));
    }
  };
  try {
    TestProject.writeFiles(root, {
      "prisma/a.prisma": `datasource db {
  provider = "postgresql"
}

model Sale {
  id String @id @db.Uuid
}
`,
      "prisma/b.prisma": `model Sale {
  id String @id @db.Uuid
}
`,
    });
    const result = await loadPrismaModels({
      root,
      sets: [
        { id: "duplicate", files: ["prisma/a.prisma", "prisma/b.prisma"] },
      ],
    });
    check("no successful document", () =>
      assert.equal(result.documents.length, 0),
    );
    check("one problem", () => assert.equal(result.problems.length, 1));
    check("duplicated model name", () =>
      assert.ok(result.problems[0]?.message.includes("Sale")),
    );
  } catch (cause) {
    failures.push(new Error("duplicate set source load", { cause }));
  } finally {
    check("cleanup:remove", () =>
      fs.rmSync(root, { recursive: true, force: true }),
    );
    check("cleanup:absence", () => assert.equal(fs.existsSync(root), false));
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      "Duplicate Prisma model set rejection failed.",
    );
}
