import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { TestProject } from "../../../utils/src/TestProject";

/**
 * Verifies model and field citation comments reach their own payload intact.
 *
 * A joined two-line model comment must remain separate from the single-line
 * price comment. The existing prose-only fixture does not exercise these
 * bytes.
 *
 * 1. Parse the original model and column citation-comment schema.
 * 2. Require one model and the documented price field with exact comment text.
 * 3. Collect assertions and exact temporary-root cleanup failures.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual loadPrismaModels and its real parser, requiring one model, exact two-line model documentation, price presence and exact single-line field documentation. This preserves the parser portion of TestPrismaBridgeCarriesDocComments, not its actual Node JSON connection.
 * @evidence contracts/testing.md#independent-expectations Original literal comment lines independently establish the two expected strings. Neither expected string is copied from parser output; wrong attachment, collapsed lines or a dropped price fail.
 * @evidence contracts/testing.md#distinguishing-cases The model's two lines contrast with the price field's one citation line. Exact declaration attachment and the field's presence are asserted. This original case does not cover blank-line detachment, unattached comments or ordinary // comments.
 * @evidence contracts/testing.md#execution-ownership Matching src/features export directly invokes maintained TypeScript source and the WASM parser in the same unit process. No consumer installation, native build or product child occurs. Admission blocks dependent payload checks; independent documentation checks and exact-root removal/absence failures are collected. Runtime and census require separate verification.
 */
export async function test_prisma_source_loader_preserves_original_documentation(): Promise<void> {
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
      documents: Array<{
        models: Array<{
          documentation: string;
          fields: Array<{ name: string; documentation: string }>;
        }>;
      }>;
      problems: unknown[];
    }>;
  };
  const root = TestProject.tmpdir("prisma-original-documentation-");
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
      "prisma/schema.prisma": `datasource db {
  provider = "postgresql"
}

/// A sale.
/// @evidence docs/spec.md#pricing the sale concept comes from here
model Sale {
  id String @id @db.Uuid

  /// @evidence docs/spec.md#amounts the amount is stored here
  price Int
}
`,
    });
    const result = await loadPrismaModels({
      root,
      sets: [{ id: "comments", files: ["prisma/schema.prisma"] }],
    });
    assert.deepEqual(result.problems, []);
    assert.equal(result.documents.length, 1);
    assert.equal(result.documents[0]!.models.length, 1);
    const model = result.documents[0]!.models[0]!;
    check("model documentation", () =>
      assert.equal(
        model.documentation,
        "A sale.\n@evidence docs/spec.md#pricing the sale concept comes from here",
      ),
    );
    const price = model.fields.find((field) => field.name === "price");
    check("price exists", () => assert.ok(price));
    check("price documentation", () =>
      assert.equal(
        price?.documentation,
        "@evidence docs/spec.md#amounts the amount is stored here",
      ),
    );
  } catch (cause) {
    failures.push(new Error("documentation source load", { cause }));
  } finally {
    check("cleanup:remove", () =>
      fs.rmSync(root, { recursive: true, force: true }),
    );
    check("cleanup:absence", () => assert.equal(fs.existsSync(root), false));
  }
  if (failures.length)
    throw new AggregateError(failures, "Original Prisma documentation failed.");
}
