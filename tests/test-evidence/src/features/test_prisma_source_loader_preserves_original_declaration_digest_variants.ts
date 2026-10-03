import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { TestProject } from "../../../utils/src/TestProject";

/**
 * Verifies the original Prisma declaration edits move only executable content.
 *
 * A review comment must not invalidate its own field. The original String type
 * variant also changes its default representation, so this case does not
 * independently isolate those two causes.
 *
 * 1. Parse the original baseline without injecting a datasource.
 * 2. Parse each of the four original literal variants independently.
 * 3. Require prose invariance and executable-edit invalidation, then clean up.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual loadPrismaModels and the real parser over the baseline and four literal schemas from TestAPrismaDigestFollowsTheDeclaration. Sale.price must carry a non-empty digest, unchanged after prose and changed after the String/default, removed unique and default-argument edits.
 * @evidence contracts/testing.md#independent-expectations The declaration contract excludes documentation and includes executable field metadata. Equality/inequality is an independent relational oracle, not an exact hash oracle. Inputs and expected relations preserve the Go case; expected hashes are never generated from loader output.
 * @evidence contracts/testing.md#distinguishing-cases Prose, removed unique and default 0 to 1 isolate their edits. Int/default 0 to String/default "0" changes two properties together and cannot certify type-only invalidation; the existing Float classification variant owns an independent type contrast. This entry claims no unrelated-column stability.
 * @evidence contracts/testing.md#execution-ownership The matching feature directly calls maintained TypeScript source and its WASM parser in this unit process, without native build, installation or product child. Every input is attempted even if baseline admission fails; only comparisons needing that baseline are blocked. Named load/assertion failures and exact temporary-root removal/absence failures are collected. Scanner census and runtime remain separate verification.
 */
export async function test_prisma_source_loader_preserves_original_declaration_digest_variants(): Promise<void> {
  const { loadPrismaModels } = createRequire(import.meta.url)(fileURLToPath(new URL(
    "../../../../packages/evidence/src/internal/loadPrismaModels.ts", import.meta.url,
  ))) as {
    loadPrismaModels(request: { root: string; sets: Array<{ id: string; files: string[] }> }): Promise<{
      documents: Array<{ models: Array<{ name: string; fields: Array<{ name: string; digest: string }> }> }>;
      problems: unknown[];
    }>;
  };
  const root = TestProject.tmpdir("prisma-original-digests-");
  const failures: Error[] = [];
  const check = (label: string, operation: () => void): void => {
    try { operation(); } catch (cause) { failures.push(new Error(label, { cause })); }
  };
  const inputs = [
    ["baseline", `model Sale {
  id String @id
  /// The buyer-facing price.
  price Int @unique @default(0)
}
`, false],
    ["documentation", `model Sale {
  id String @id
  /// An entirely different wording of the same thing.
  price Int @unique @default(0)
}
`, false],
    ["type-and-default-representation", `model Sale {
  id String @id
  /// The buyer-facing price.
  price String @unique @default("0")
}
`, true],
    ["removed-unique", `model Sale {
  id String @id
  /// The buyer-facing price.
  price Int @default(0)
}
`, true],
    ["default-argument", `model Sale {
  id String @id
  /// The buyer-facing price.
  price Int @unique @default(1)
}
`, true],
  ] as const;
  let baseline: string | undefined;
  try {
    for (const [label, schema, moved] of inputs) {
      try {
        const source = label + ".prisma";
        TestProject.writeFiles(root, { [source]: schema });
        const result = await loadPrismaModels({ root, sets: [{ id: label, files: [source] }] });
        assert.deepEqual(result.problems, [], label);
        assert.equal(result.documents.length, 1, label);
        const digest = result.documents[0]!.models.find(model => model.name === "Sale")
          ?.fields.find(field => field.name === "price")?.digest;
        assert.equal(typeof digest, "string", label);
        assert.notEqual(digest, "", label);
        if (label === "baseline") baseline = digest;
        else if (baseline !== undefined)
          check(label + ":digest relation", () => assert.equal(digest !== baseline, moved));
      } catch (cause) {
        failures.push(new Error(label + ":source load", { cause }));
      }
    }
  } finally {
    check("cleanup:remove", () => fs.rmSync(root, { recursive: true, force: true }));
    check("cleanup:absence", () => assert.equal(fs.existsSync(root), false));
  }
  if (failures.length) throw new AggregateError(failures, "Original Prisma declaration digest variants failed.");
}
