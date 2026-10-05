import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { MetroWorkspace } from "../../../internal/metro/internal/MetroWorkspace";
import { TestMetroRuntime } from "../../../internal/metro/internal/metro-runtime";
import { prepareSnapshot } from "../../../internal/metro/internal/metro-snapshot";

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
 * @evidence contracts/testing.md#distinguishing-cases The unchanged entry depends on a mutated in-project helper. Each observation first checks unchanged-input key stability, rejecting random fallback nonce as the cause of inequality, then checks the independent FIRST or SECOND output marker; external observation retention is a separate input.
 * @evidence contracts/testing.md#execution-ownership test_e2e_metro calls this selected scenario. The default built transformer plus authored echo upstream exercises adapter/native output delivery, not a real Metro server/OS worker. TTSC_TEST_LAYER=unit instead selects authored modules and does not establish the built boundary.
 * @evidence contracts/e2e.md#necessary-boundary Native plugin dependency output must reach the Metro adapter and its subsequent compile, so direct fingerprint fixtures cannot prove transformed output refresh.
 * @evidence contracts/e2e.md#shared-execution Two transform observations reuse one project and selected shared producer cache. Repeated key calls add no transform; changed helper output is asserted without inferring Program generation/cache-hit/native child counts. Fresh query imports are same-suite modules, not OS workers, and no second installation is prepared.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each fresh transformer module sees its intended helper state, and runtime options env is restored after the awaited callback. Slot reset removes old snapshot input and the parent independently aggregates workspace cleanup. Module freshness, returned output and path removal do not certify descendant joins or loaded-image equality.
 * @evidence contracts/e2e.md#preserved-coverage Original FIRST/SECOND output markers, unchanged main entry and changed-key inequality remain, strengthened by repeated stable-key controls. No generic portable-owner address or execution is fabricated; registration, actual runtime survival and cost measurement remain unverified.
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
    async (mod) => {
      const key = mod.getCacheKey({ projectRoot: root }) as string;
      assert.equal(
        mod.getCacheKey({ projectRoot: root }),
        key,
        "unchanged first input must retain the key",
      );
      return {
        key,
        result: await mod.transform({
          src: TestUnpluginProject.mainSource(root),
          filename: "src/main.ts",
          options: { projectRoot: root },
        }),
      };
    },
  );
  assert.match(runOne.result.ast.src, /PLUGIN:FIRST/);

  fs.writeFileSync(helper, "second\n", "utf8");
  const runTwo = await TestMetroRuntime.withTransformerEnv(
    options,
    async (mod) => {
      const key = mod.getCacheKey({ projectRoot: root }) as string;
      assert.equal(
        mod.getCacheKey({ projectRoot: root }),
        key,
        "unchanged second input must retain the key",
      );
      return {
        key,
        result: await mod.transform({
          src: TestUnpluginProject.mainSource(root),
          filename: "src/main.ts",
          options: { projectRoot: root },
        }),
      };
    },
  );
  assert.notEqual(runTwo.key, runOne.key);
  assert.match(runTwo.result.ast.src, /PLUGIN:SECOND/);
}
