import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { resolveOwningProjectConfig } from "../../../../../packages/ttsc/src/compiler/internal/project/resolveOwningProjectConfig";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies an owning-project lookup reuses the expanded reference roots its
 * caller keeps, and still expands afresh for a file created after them
 * (samchon/ttsc#1747).
 *
 * Under ttsx every module served through a solution-style tsconfig asked the
 * compiler to expand each referenced project again with `--showConfig`, while
 * the project build the answer selects is made once per process.
 *
 * 1. Look up two modules of a solution layout through one expansions map: both are
 *    owned by the referenced project, and the second lookup reuses the first
 *    expansion object.
 * 2. Create a module after that expansion and look it up: it is owned by the
 *    referenced project through a new expansion.
 * 3. Look up a module without a map: the answer is the same.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual lookup runs the installed compiler's `--showConfig` over a real solution layout; the selected configs and the kept expansion objects are the observed behavior.
 * @evidence contracts/testing.md#independent-expectations The authored references and includes fix which config owns each module.
 * @evidence contracts/testing.md#distinguishing-cases Modules present at the first expansion, a module created after it, and a lookup without a map are separate rows.
 * @evidence contracts/testing.md#execution-ownership This source unit owns its temporary project below the checkout's ignored `.cache` and runs the workspace's TypeScript-Go compiler for `--showConfig` only.
 */
export function test_owning_project_lookup_keeps_expansions_for_its_caller(): void {
  // Below the checkout, so the lookup resolves the workspace's compiler.
  const root = TestProject.physicalPath(
    TestProject.tmpdir(
      "ttsc-owning-expansions-",
      path.join(TestProject.WORKSPACE_ROOT, ".cache"),
    ),
  );
  const solution = path.join(root, "tsconfig.json");
  const library = path.join(root, "tsconfig.lib.json");
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(
    solution,
    JSON.stringify({
      files: [],
      references: [{ path: "./tsconfig.lib.json" }],
    }),
  );
  fs.writeFileSync(
    library,
    JSON.stringify({
      compilerOptions: { composite: true, noEmit: true },
      include: ["src"],
    }),
  );
  const module = (name: string): string => {
    const file = path.join(root, "src", `${name}.ts`);
    fs.writeFileSync(file, `export const ${name} = 1;\n`);
    return file;
  };
  const first = module("first");
  const second = module("second");
  const expansions = new Map<
    string,
    { files: readonly string[]; takenAt: number }
  >();
  const lookup = (file: string) =>
    resolveOwningProjectConfig({ expansions, file, tsconfig: solution });

  assert.equal(lookup(first), library);
  const kept = expansions.get(library);
  assert.ok(kept, "the referenced project's expansion is kept");
  assert.equal(lookup(second), library);
  assert.equal(expansions.get(library), kept, "a later module reuses it");

  const created = path.join(root, "src", "created.ts");
  fs.writeFileSync(created, "export const created = 1;\n");
  assert.equal(lookup(created), library, "a later file is still owned");
  assert.notEqual(
    expansions.get(library),
    kept,
    "a file created after the expansion is expanded for afresh",
  );

  assert.equal(
    resolveOwningProjectConfig({ file: second, tsconfig: solution }),
    library,
    "a lookup without a map answers the same",
  );
}
