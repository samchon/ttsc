import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { TestProject } from "../../../utils/src/TestProject";

/**
 * Verifies original Prisma source populations and ordered two-file byte
 * identity.
 *
 * The parser payload and byte framing are portable source operations. Physical
 * root deduplication, line scanning, native unit projection and cross-language
 * transport remain with their separate owners.
 *
 * 1. Parse the original bridge schema and assert its six original kind pairs.
 * 2. Parse its original Extra-file set and require an independently framed digest.
 * 3. Parse the original sale/refund file pair and require both model payloads.
 * 4. Collect every load/assertion and exact temporary-root cleanup failure.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual loadPrismaModels and its real filesystem/parser. The bridge-schema row preserves the six payload counterparts of the current located-population kind assertions. The original two-file native-digest row requires one document and exact nonempty byte framing for schema.prisma plus seller.prisma containing Extra. The original two-root row loads mirror/main.prisma then store/main.prisma and requires refund and sale payloads. G scanner/path/root decisions and native digest, plus E interoperability, are not executed here.
 * @evidence contracts/testing.md#independent-expectations Original schemas independently establish model/member names and kinds. Exact path-plus-NUL-plus-raw-SHA256-plus-newline framing is independently assembled from authored bytes in request order. This improves the source digest oracle beyond Node/native equality but does not certify cross-language interoperability. Model names are literal expectations, not observed snapshots.
 * @evidence contracts/testing.md#distinguishing-cases The single bridge schema includes model/scalar/forward relation/back-reference kinds. Its two-file Extra population exposes both source-path framing and content, while equal relative basenames under store/mirror contain different sale/refund models and both must survive a supplied combined set. This entry does not claim physical-file deduplication or any original scanner line assertions. Rejected and missing-set controls belong to the failure-attribution unit.
 * @evidence contracts/testing.md#execution-ownership Matching feature executes maintained source reads and the actual WASM parser in one unit Node process, with no native build, consumer install or product child. Three independently named set loads continue after failure; admission gates only that row's payload assertions. Exact tracked-root removal/absence failures are collected. Runtime and exact scanner census require separate verification.
 */
export async function test_prisma_source_loader_preserves_original_source_sets(): Promise<void> {
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
        digest: string;
        models: Array<{
          name: string;
          fields: Array<{ name: string; symbol: string }>;
        }>;
      }>;
      problems: unknown[];
    }>;
  };
  const root = TestProject.tmpdir("prisma-original-source-sets-");
  const failures: Error[] = [];
  const check = (label: string, operation: () => void): void => {
    try {
      operation();
    } catch (cause) {
      failures.push(new Error(label, { cause }));
    }
  };
  const schema = `datasource db {
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
  const extra = "model Extra {\n  id String @id @db.Uuid\n}\n";
  try {
    TestProject.writeFiles(root, {
      "prisma/schema.prisma": schema,
      "prisma/seller.prisma": extra,
      "store/main.prisma": "model sale {\n  id String @id\n}\n",
      "mirror/main.prisma": "model refund {\n  id String @id\n}\n",
    });
    for (const [label, files] of [
      ["located-payload", ["prisma/schema.prisma"]],
      ["two-file-digest", ["prisma/schema.prisma", "prisma/seller.prisma"]],
      ["sale-refund-set", ["mirror/main.prisma", "store/main.prisma"]],
    ] as const) {
      try {
        const result = await loadPrismaModels({
          root,
          sets: [{ id: label, files: [...files] }],
        });
        assert.deepEqual(result.problems, [], label);
        assert.equal(result.documents.length, 1, label);
        const document = result.documents[0]!;
        if (label === "located-payload") {
          for (const [name, field, kind] of [
            ["Sale", undefined, "model"],
            ["Sale", "price", "column"],
            ["Sale", "seller_id", "column"],
            ["Sale", "seller", "relation"],
            ["Seller", undefined, "model"],
            ["Seller", "sales", "relation"],
          ] as const)
            check(label + ":" + name + (field ? "." + field : ""), () => {
              const model = document.models.find(
                (value) => value.name === name,
              );
              if (field === undefined) assert.ok(model);
              else
                assert.equal(
                  model?.fields.find((value) => value.name === field)?.symbol,
                  kind,
                );
            });
        } else if (label === "two-file-digest") {
          const framed = [
            ["prisma/schema.prisma", schema],
            ["prisma/seller.prisma", extra],
          ]
            .map(
              ([source, text]) =>
                source +
                "\u0000" +
                createHash("sha256").update(text!).digest("hex") +
                "\n",
            )
            .join("");
          const expected = createHash("sha256").update(framed).digest("hex");
          check(label + ":digest", () =>
            assert.equal(document.digest, expected),
          );
          check(label + ":nonempty", () =>
            assert.notEqual(document.digest, ""),
          );
        } else {
          check(label + ":both models", () =>
            assert.deepEqual(
              document.models.map((model) => model.name),
              ["refund", "sale"],
            ),
          );
        }
      } catch (cause) {
        failures.push(new Error(label + ":source load", { cause }));
      }
    }
  } catch (cause) {
    failures.push(new Error("source set preparation", { cause }));
  } finally {
    check("cleanup:remove", () =>
      fs.rmSync(root, { recursive: true, force: true }),
    );
    check("cleanup:absence", () => assert.equal(fs.existsSync(root), false));
  }
  if (failures.length)
    throw new AggregateError(failures, "Original Prisma source sets failed.");
}
