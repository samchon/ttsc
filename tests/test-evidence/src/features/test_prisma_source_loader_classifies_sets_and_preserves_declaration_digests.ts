import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { TestProject } from "../../../utils/src/TestProject";

/**
 * Verifies the Prisma source loader classifies a multi-file schema and keeps
 * declaration digests independent from documentation and sibling fields.
 *
 * The parser executes in this Node process. The Go bridge separately owns
 * package resolution and JSON transport; neither is needed for these semantics.
 *
 * 1. Parse two related models from one authored schema set and assert every
 *    field's classification and documentation.
 * 2. Edit field documentation, type, unique and default metadata and a model-level
 *    attribute separately.
 * 3. Require documentation invariance and declaration-local invalidation while
 *    unchanged model and sibling declarations retain their digests.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual loadPrismaModels source API and asserts the complete two-model field classification, exact documentation and per-declaration digest change or invariance under four independent field edits and one model attribute edit.
 * @evidence contracts/testing.md#independent-expectations The literal scalar, foreign-key and list/optional relation table comes from the authored Prisma declarations. Digest comparisons follow the contract that documentation is excluded and each model or field owns its own executable metadata; they do not certify exact hash encoding.
 * @evidence contracts/testing.md#distinguishing-cases A multi-file set includes required scalars, an optional relation with onDelete and its list back-reference. Four separately valid field variants isolate documentation, type, uniqueness and default changes, and one model-level `@@map` variant is the positive arm for the model digest; sibling, field and model controls distinguish overbroad invalidation from a missing change.
 * @evidence contracts/testing.md#execution-ownership This matching test-evidence feature directly imports the maintained TypeScript source API and invokes its dependency parser in the same process over temporary resolver inputs. It builds no artifact, installs no consumer and launches no Go or Node child. All variant assertion failures are collected before the entry fails.
 */
export async function test_prisma_source_loader_classifies_sets_and_preserves_declaration_digests(): Promise<void> {
  const { loadPrismaModels } = createRequire(import.meta.url)(fileURLToPath(new URL(
    "../../../../packages/evidence/src/internal/loadPrismaModels.ts", import.meta.url,
  ))) as {
    loadPrismaModels(request: { root: string; sets: Array<{ id: string; files: string[] }> }): Promise<{
      documents: Array<{ id: string; digest: string; models: Array<{
        name: string; documentation: string; digest: string;
        fields: Array<{ name: string; symbol: string; documentation: string; digest: string }>;
      }> }>;
      problems: Array<{ id: string; message: string; digest: string }>;
    }>;
  };
  const root = TestProject.tmpdir("prisma-source-semantics-");
  const schema = `datasource db {
  provider = "postgresql"
}

/// A sale.
model Sale {
  id String @id
  /// The buyer-facing price.
  price Int @unique @default(0)
  seller_id String?
  seller Seller? @relation(fields: [seller_id], references: [id], onDelete: SetNull)
}
`;
  TestProject.writeFiles(root, {
    "schema.prisma": schema,
    "seller.prisma": "model Seller {\n  id String @id\n  sales Sale[]\n}\n",
  });
  const load = () => loadPrismaModels({ root, sets: [{ id: "sales", files: ["schema.prisma", "seller.prisma"] }] });
  try {
    const before = await load();
    assert.deepEqual(before.problems, []);
    assert.equal(before.documents.length, 1);
    const baseline = before.documents[0]!;
    assert.equal(baseline.id, "sales");
    assert.match(baseline.digest, /^[0-9a-f]{64}$/);
    assert.deepEqual(baseline.models.map(model => [model.name, model.fields.map(field => [field.name, field.symbol])]), [
      ["Sale", [["id", "column"], ["price", "column"], ["seller_id", "column"], ["seller", "relation"]]],
      ["Seller", [["id", "column"], ["sales", "relation"]]],
    ]);
    const sale = baseline.models[0]!;
    assert.equal(sale.documentation, "A sale.");
    assert.equal(sale.fields[1]!.documentation, "The buyer-facing price.");
    const failures: unknown[] = [];
    for (const [label, source, changed] of [
      ["documentation", schema.replace("The buyer-facing price.", "A revised explanation."), false],
      ["type", schema.replace("price Int @unique @default(0)", "price Float @unique @default(0)"), true],
      ["unique", schema.replace("price Int @unique @default(0)", "price Int @default(0)"), true],
      ["default", schema.replace("@default(0)", "@default(1)"), true],
    ] as const) {
      try {
        fs.writeFileSync(path.join(root, "schema.prisma"), source);
        const after = await load();
        assert.deepEqual(after.problems, [], label);
        const next = after.documents[0]!;
        assert.equal(next.models[0]!.digest, sale.digest, label + ": model metadata is unchanged");
        assert.equal(next.models[1]!.digest, baseline.models[1]!.digest, label + ": sibling model is unchanged");
        for (const index of [0, 2, 3]) assert.equal(next.models[0]!.fields[index]!.digest, sale.fields[index]!.digest, label + ": sibling field is unchanged");
        assert.equal(next.models[0]!.fields[1]!.digest !== sale.fields[1]!.digest, changed, label);
      } catch (error) { failures.push(error); }
    }
    try {
      // A model-level attribute belongs to the model declaration alone: it must
      // move the model digest and leave every field and the sibling model alone.
      fs.writeFileSync(path.join(root, "schema.prisma"), schema.replace("onDelete: SetNull)\n}", "onDelete: SetNull)\n\n  @@map(\"sale_rows\")\n}"));
      const after = await load();
      assert.deepEqual(after.problems, [], "model attribute");
      const next = after.documents[0]!;
      assert.notEqual(next.models[0]!.digest, sale.digest, "model attribute: the model declaration changed");
      assert.equal(next.models[1]!.digest, baseline.models[1]!.digest, "model attribute: sibling model is unchanged");
      for (const index of [0, 1, 2, 3]) assert.equal(next.models[0]!.fields[index]!.digest, sale.fields[index]!.digest, "model attribute: field is unchanged");
    } catch (error) { failures.push(error); }
    if (failures.length) throw new AggregateError(failures, "Prisma declaration distinctions failed.");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
