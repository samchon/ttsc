import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { TestProject } from "../../../utils/src/TestProject";

/**
 * Verifies a new Prisma field leaves model and sibling declaration digests
 * intact.
 *
 * The source payload must include the added field without folding it into the
 * model's own digest. Native scope membership and composition are a separate
 * operation and are not reproduced in this source unit.
 *
 * 1. Parse the original Sale id/price schema and its currency addition.
 * 2. Require non-empty after digests and the actual added currency column.
 * 3. Require model and price stability and collect cleanup failures.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual loadPrismaModels and its real parser for the two original TestAnAddedPrismaFieldMovesTheScopeAndNotTheModel inputs. Every returned after model/field digest must be non-empty, currency must exist as a column, and Sale own and Sale.price digests must remain equal to their before values.
 * @evidence contracts/testing.md#independent-expectations A model declaration excludes its fields and an untouched price declaration retains its content. The authored currency String independently establishes the added payload member. These are relational expectations, not exact hash values; native newScopeIndex fingerprint change belongs to the Go direct-unit owner.
 * @evidence contracts/testing.md#distinguishing-cases The exact Sale{id,price} before schema contrasts with Sale{id,price,currency} after. Added payload membership plus non-empty digest checks distinguish a silently dropped field from a passing equality on absence. Model/price stability rejects overbroad invalidation. No TypeScript reimplementation or assertion of the native scope algorithm appears here.
 * @evidence contracts/testing.md#execution-ownership This matching src/features export runs maintained TypeScript source and the dependency parser in the same unit process over independent temporary files, without a native producer, consumer install or product child. Both loads are attempted independently; cross-input comparisons require both admissions. Named assertions and exact tracked-root cleanup errors are collected. Execution/census are separate from this authored body.
 */
export async function test_prisma_source_loader_keeps_model_digest_when_a_field_is_added(): Promise<void> {
  type Model = {
    name: string;
    digest: string;
    fields: Array<{ name: string; symbol: string; digest: string }>;
  };
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
      documents: Array<{ models: Model[] }>;
      problems: unknown[];
    }>;
  };
  const root = TestProject.tmpdir("prisma-added-field-source-");
  const failures: Error[] = [];
  const check = (label: string, operation: () => void): void => {
    try {
      operation();
    } catch (cause) {
      failures.push(new Error(label, { cause }));
    }
  };
  const parsed = new Map<string, Model[]>();
  try {
    for (const [label, schema] of [
      [
        "before",
        `model Sale {
  id String @id
  price Int
}
`,
      ],
      [
        "after",
        `model Sale {
  id String @id
  price Int
  currency String
}
`,
      ],
    ] as const) {
      try {
        const source = label + ".prisma";
        TestProject.writeFiles(root, { [source]: schema });
        const result = await loadPrismaModels({
          root,
          sets: [{ id: label, files: [source] }],
        });
        assert.deepEqual(result.problems, [], label);
        assert.equal(result.documents.length, 1, label);
        parsed.set(label, result.documents[0]!.models);
      } catch (cause) {
        failures.push(new Error(label + ":source load", { cause }));
      }
    }
    const before = parsed.get("before")?.find((model) => model.name === "Sale");
    const afterModels = parsed.get("after");
    const after = afterModels?.find((model) => model.name === "Sale");
    if (afterModels !== undefined) {
      for (const model of afterModels) {
        check(model.name + ":after digest", () => {
          assert.equal(typeof model.digest, "string");
          assert.notEqual(model.digest, "");
        });
        for (const field of model.fields)
          check(model.name + "." + field.name + ":after digest", () => {
            assert.equal(typeof field.digest, "string");
            assert.notEqual(field.digest, "");
          });
      }
      check("currency column", () =>
        assert.equal(
          after?.fields.find((field) => field.name === "currency")?.symbol,
          "column",
        ),
      );
    }
    if (parsed.has("before") && parsed.has("after")) {
      check("before Sale", () => assert.ok(before));
      check("after Sale", () => assert.ok(after));
      check("model own digest", () => {
        assert.ok(before && after);
        assert.equal(typeof before.digest, "string");
        assert.notEqual(before.digest, "");
        assert.equal(after.digest, before.digest);
      });
      check("price digest", () => {
        const prior = before?.fields.find((field) => field.name === "price");
        const next = after?.fields.find((field) => field.name === "price");
        assert.ok(prior && next);
        assert.equal(typeof prior.digest, "string");
        assert.notEqual(prior.digest, "");
        assert.equal(next.digest, prior.digest);
      });
    }
  } finally {
    check("cleanup:remove", () =>
      fs.rmSync(root, { recursive: true, force: true }),
    );
    check("cleanup:absence", () => assert.equal(fs.existsSync(root), false));
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      "Added Prisma field declaration distinctions failed.",
    );
}
