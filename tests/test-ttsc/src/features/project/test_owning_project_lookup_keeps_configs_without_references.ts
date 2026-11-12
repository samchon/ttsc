import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { resolveOwningProjectConfig } from "../../../../../packages/ttsc/src/compiler/internal/project/resolveOwningProjectConfig";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies an owning-project lookup keeps a config that declares no reference
 * only while that file is unchanged, and reads it again once it is edited.
 *
 * Under ttsx every served module asked which project owns it, and each lookup
 * read and parsed the same nearest tsconfig again (samchon/ttsc#1852). A config
 * without references owns its files by itself, so only an edit can change the
 * answer.
 *
 * 1. Look up a module through a config with no references: it owns the module and
 *    is kept with its metadata.
 * 2. Look it up again: the same answer, the config still reported to the caller's
 *    observer.
 * 3. Edit the config to reference the project that includes the module: the kept
 *    entry is dropped and the referenced project owns it.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual lookup runs over real config files and, once a reference exists, the installed compiler's root expansion; the selected config, the observer calls and the kept map are the observed behavior.
 * @evidence contracts/testing.md#independent-expectations The authored configs fix the owner: no reference means the nearest config, and a reference to the one project including the module means that project.
 * @evidence contracts/testing.md#distinguishing-cases A first lookup, an unchanged repeat, and a lookup after the config gained a reference separate a kept answer from a stale one; a lookup without the map answers the same throughout.
 * @evidence contracts/testing.md#execution-ownership This source unit owns its temporary project below the checkout's ignored `.cache` and runs the workspace's TypeScript-Go compiler only for the referenced project's root expansion.
 */
export function test_owning_project_lookup_keeps_configs_without_references(): void {
  // Below the checkout, so the lookup resolves the workspace's compiler.
  const root = TestProject.physicalPath(
    TestProject.tmpdir(
      "ttsc-owning-unreferenced-",
      path.join(TestProject.WORKSPACE_ROOT, ".cache"),
    ),
  );
  const nearest = path.join(root, "tsconfig.json");
  const library = path.join(root, "tsconfig.lib.json");
  const module = path.join(root, "src", "module.ts");
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(module, "export const value = 1;\n");
  fs.writeFileSync(nearest, JSON.stringify({ include: ["src"] }));
  fs.writeFileSync(
    library,
    JSON.stringify({
      compilerOptions: { composite: true, noEmit: true },
      include: ["src"],
    }),
  );
  const unreferenced = new Map<string, string>();
  const observed: string[] = [];
  const lookup = (): string =>
    resolveOwningProjectConfig({
      file: module,
      onConfig: (config) => observed.push(config),
      tsconfig: nearest,
      unreferenced,
    });

  assert.equal(lookup(), nearest);
  assert.ok(unreferenced.has(nearest), "a config without references is kept");
  const reported = observed.length;
  assert.equal(lookup(), nearest);
  assert.ok(
    observed.length > reported && observed.at(-1) === nearest,
    "a kept config is still reported to the observer",
  );

  fs.writeFileSync(
    nearest,
    JSON.stringify({
      files: [],
      references: [{ path: "./tsconfig.lib.json" }],
    }),
  );
  assert.equal(lookup(), library, "an edited config is read again");
  assert.equal(unreferenced.has(nearest), false, "and no longer kept");
  assert.equal(
    resolveOwningProjectConfig({ file: module, tsconfig: nearest }),
    library,
    "a lookup without a map answers the same",
  );
}
