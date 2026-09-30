import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { resolveProjectSelection } from "../../../../../packages/unplugin/src/core/transform/tsconfig/resolveProjectSelection";
import type { TtscWatchInput } from "../../../../../packages/unplugin/src/core/transform/watch/TtscWatchInput";
import { selectionInputs } from "../../../../../packages/unplugin/src/core/transform/watch/selectionInputs";

/**
 * Verifies project selection reports the nearer `tsconfig.json` candidates it
 * passed over, so one appearing reaches the host as a changed input.
 *
 * The walk that finds a file's nearest config probed every nearer directory and
 * found no config there, then dropped those observations. A `tsconfig.json`
 * created beside the file re-routes it to another project, yet no registered
 * input named that path, so a watching host kept the module it had transformed
 * under the old project (samchon/ttsc#1543).
 *
 * 1. Select a file two directories below the only config.
 * 2. Assert both nearer candidates are consulted, as missing watch inputs, and the
 *    selected config is not among them.
 * 3. Create the nearer config and select again: it is selected, only the one
 *    candidate still nearer is consulted, and the old evidence no longer
 *    holds.
 * @evidence contracts/testing.md#behavioral-verification Actual project selection reports absent nearer configs and selectionInputs marks their missing evidence; creating the nearer config reroutes selection and changes the old absence reading.
 * @evidence contracts/testing.md#independent-expectations Literal nearest/nearer/root config paths and [true,true] missing flags establish expected routing and evidence without copying the resolver answer.
 * @evidence contracts/testing.md#distinguishing-cases Two absent candidates, selected config exclusion, nearer config appearance, shortened consulted list and absence-to-present evidence retain every original control.
 * @evidence contracts/testing.md#execution-ownership The named source unit calls authored selection and evidence readers on real fixture files. It starts no watcher or transform host to observe config routing.
 */
export async function test_project_selection_consults_the_nearer_configs_it_passed_over(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-nearer-config-"),
  );
  TestProject.writeFiles(root, {
    "tsconfig.json": JSON.stringify({ include: ["src"] }),
    "src/feature/main.ts": "export {};\n",
  });
  const file = path.join(root, "src", "feature", "main.ts");
  const nearest = path.join(root, "src", "feature", "tsconfig.json");
  const nearer = path.join(root, "src", "tsconfig.json");

  const before = resolveProjectSelection(file);
  assert.equal(before.tsconfig, path.join(root, "tsconfig.json"));
  assert.deepEqual(before.consulted, [nearest, nearer]);
  const inputs = selectionInputs(
    before.consulted,
    DEFAULT_FILESYSTEM_OPERATIONS,
    (input: string) => input,
  );
  assert.deepEqual(
    inputs.map((input: TtscWatchInput) => input.evidence?.missing),
    [true, true],
  );

  fs.writeFileSync(nearer, JSON.stringify({ include: ["."] }));
  const after = resolveProjectSelection(file);
  assert.equal(after.tsconfig, nearer);
  assert.deepEqual(after.consulted, [nearest]);
  const reread = selectionInputs(
    before.consulted,
    DEFAULT_FILESYSTEM_OPERATIONS,
    (input: string) => input,
  );
  assert.equal(
    reread[1]?.evidence?.missing,
    false,
    "the created config no longer matches its recorded absence",
  );
}
