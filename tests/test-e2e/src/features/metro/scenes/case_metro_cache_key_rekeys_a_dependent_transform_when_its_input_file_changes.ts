import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { MetroWorkspace } from "../../../internal/metro/internal/MetroWorkspace";
import { prepareSnapshot } from "../../../internal/metro/internal/metro-snapshot";
import { TestMetroRuntime } from "../../../internal/metro/internal/metro-runtime";

/**
 * Verifies the two-run acceptance reproduction of samchon/ttsc#721, in-project
 * direction: edit only a file the transform's output depends on, re-run without
 * `--reset-cache`, and the run is re-keyed with the regenerated output.
 *
 * The dependent file's own content never changes, which is exactly the v1
 * staleness class: Metro's per-content key would have replayed the run-1 output
 * forever. Exercises the real native compiler, so it runs where the Go
 * toolchain is present (CI), like the other plugin-pass scenarios.
 *
 * 1. Project whose plugin output embeds `src/helper.ts` content ("first"); run 1
 *    computes the key and transforms `src/main.ts` → `PLUGIN:FIRST`.
 * 2. Edit only `src/helper.ts` to "second".
 * 3. Run 2 (fresh module): the key differs and the transform carries
 *    `PLUGIN:SECOND`.
 *
 * @evidence contracts/testing.md#behavioral-verification An actual native plugin reads helper.ts and emits PLUGIN:FIRST, then editing only that helper changes the Metro key and emits PLUGIN:SECOND.
 * @evidence contracts/testing.md#independent-expectations The authored helper bytes and literal plugin markers independently require changed downstream output, while key inequality follows dependency invalidation.
 * @evidence contracts/testing.md#distinguishing-cases An unchanged transform entry depends on a mutated in-project helper, distinct from out-of-project observation retention.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_metro, which is discovered under src/features and selected by the E2E Evidence claim; this exported scenario executes the compiled Metro package, while source units own its portable decisions.
 * @evidence contracts/e2e.md#necessary-boundary Native plugin dependency output must reach the Metro adapter and its subsequent compile, so direct fingerprint fixtures cannot prove transformed output refresh.
 * @evidence contracts/e2e.md#shared-execution Both observations reuse one project and the suite shared content-addressed plugin source/build cache. The changed helper genuinely requires a new compiler generation; no second installation occurs. Its project is a slot of the experiment's single workspace, written or copied by MetroWorkspace instead of being created as a separate temporary directory.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each fresh worker module belongs to its input state; only helper bytes change between runs and options are restored after each worker. Entering the slot replaces it, which removes any earlier snapshot, epoch and recorded input, and the experiment removes the whole workspace and verifies its absence once, after the last scenario.
 * @evidence contracts/e2e.md#preserved-coverage The original FIRST/SECOND output markers and changed-key assertion remain in this native boundary; portable key and membership decisions retain source-unit owners.
 */
export async function case_metro_cache_key_rekeys_a_dependent_transform_when_its_input_file_changes(
  workspace: MetroWorkspace.IWorkspace,
): Promise<void> {
  const root = MetroWorkspace.enterProject(workspace, {
    plugins: [
      { transform: "./plugin.cjs", name: "fixture", operation: "read-helper" },
    ],
  });
  const helper = path.join(root, "src", "helper.ts");
  fs.writeFileSync(helper, "first\n", "utf8");
  await prepareSnapshot(root);

  const options = {
    upstreamTransformer: TestMetroRuntime.fakeUpstreamPathOnDisk(),
  };
  const runOne = await TestMetroRuntime.withTransformerEnv(
    options,
    async (mod) => ({
      key: mod.getCacheKey({ projectRoot: root }) as string,
      result: await mod.transform({
        src: TestUnpluginProject.mainSource(root),
        filename: "src/main.ts",
        options: { projectRoot: root },
      }),
    }),
  );
  assert.match(runOne.result.ast.src, /PLUGIN:FIRST/);

  fs.writeFileSync(helper, "second\n", "utf8");
  const runTwo = await TestMetroRuntime.withTransformerEnv(
    options,
    async (mod) => ({
      key: mod.getCacheKey({ projectRoot: root }) as string,
      result: await mod.transform({
        src: TestUnpluginProject.mainSource(root),
        filename: "src/main.ts",
        options: { projectRoot: root },
      }),
    }),
  );
  assert.notEqual(runTwo.key, runOne.key);
  assert.match(runTwo.result.ast.src, /PLUGIN:SECOND/);
}
